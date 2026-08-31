const h=require('../lib/nutrition-engine-host.js');
const base={gender:'male',age:30,height:178,weight:82,target:75,activity:1.55,goal:'lose',selectedDiet:'balanced',mealCount:4};
function planFoods(r){const out=[];(r.plan&&r.plan.meals||[]).forEach(m=>{(m.foods||[]).forEach(f=>out.push(f.nameAr||f.name||f.id||JSON.stringify(f).slice(0,30)));});return out;}
function labels(r){return (r.plan&&r.plan.meals||[]).map(m=>m.label);}

console.log('=== (1) DIABETES+GOUT+BP therapeutic pruning ===');
const rSick=h.computeMealPlan(Object.assign({},base,{healthConditions:['diabetes','gout','bp']}),{'inp-meals':4});
console.log('healthPruned:',rSick.healthPruned,'pantrySize:',rSick.pantrySize);
const sf=planFoods(rSick);
console.log('plan foods:',sf);
const bad=/سكر|عسل|تمر|بلح|مانجو|بطيخ|رز ابيض|عيش ابيض|كبد|كلاوي|سردين|رنجة|جمبري|مخلل|لانشون|سجق|بسطرمة/;
const offenders=sf.filter(x=>bad.test(require('../lib/nutrition-engine-host.js') && x.normalize? x: x));
console.log('SUSPECT offenders in plan:',sf.filter(x=>/سكر|عسل|تمر|بلح|مانجو|بطيخ|كبد|كلاوي|سردين|رنجة|جمبري|مخلل|لانشون|سجق|بسطرمة/.test(x)));

console.log('\n=== (2) picker respects health: diabetic searching فاكهة ===');
const fr=h.searchFoods({category:'fruit',health:['diabetes']}).map(f=>f.nameAr);
console.log('diabetic fruit (should exclude تمر/بلح/مانجو/بطيخ):',fr);

console.log('\n=== (3) RAMADAN schedule ===');
const rRam=h.computeMealPlan(Object.assign({},base,{healthConditions:[],fastingMode:'ramadan'}),{'inp-meals':4});
console.log('labels:',labels(rRam));
console.log('scheduleNote:',rRam.plan&&rRam.plan.scheduleNote);
console.log('fastingMode tag:',rRam.plan&&rRam.plan.fastingMode);

console.log('\n=== (4) IF 16:8 schedule ===');
const rIf=h.computeMealPlan(Object.assign({},base,{fastingMode:'if16'}),{'inp-meals':4});
console.log('labels:',labels(rIf));
console.log('scheduleNote:',rIf.plan&&rIf.plan.scheduleNote);

console.log('\n=== (5) normal unchanged (macros identical Ramadan vs normal) ===');
const rNorm=h.computeMealPlan(Object.assign({},base),{'inp-meals':4});
console.log('normal labels:',labels(rNorm));
console.log('normal totalCals:',rNorm.plan&&rNorm.plan.totals&&rNorm.plan.totals.cals, 'ramadan totalCals:',rRam.plan&&rRam.plan.totals&&rRam.plan.totals.cals);
