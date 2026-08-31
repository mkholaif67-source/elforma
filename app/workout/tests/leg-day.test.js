// اختبار انحدار: يوم الأرجل المنفصل (legs alone) لا يقل عن 6 تمارين وكلها أرجل
// يحمّل محرك التوليد في سياق vm ويستدعي pickExercises مباشرة.
const fs = require('fs');
const vm = require('vm');
const path = __dirname + '/../';
const files = ['engine/state.js','engine/db.js','engine/rest.js','engine/constants.js','engine/utils.js','engine/analysis.js','engine/splits.js','engine/planner.js'];

const sandbox = { console, window:{}, document:undefined, setTimeout, clearTimeout, Math, Date, JSON, Object, Array, Set, Map,
  fetch: () => Promise.resolve({ ok:false, status:0 }),
  AbortController: function(){ this.signal={}; this.abort=function(){}; },
  localStorage: { getItem:()=>null, setItem:()=>{}, removeItem:()=>{} } };
sandbox.global = sandbox;
vm.createContext(sandbox);
for (const f of files) vm.runInContext(fs.readFileSync(path+f,'utf8'), sandbox, { filename:f });

sandbox.state = { equip:'gym', injuries:[], goal:'muscle', time:60, exp:'advanced', gender:'male', days:5, recoveryScore:75, weak:[], bmi:24, age:28, plan:[], recommendedSplit:null, selectedSplit:null, splitDays:5 };
const pick = sandbox.pickExercises;
const LEG = new Set(['quads','hamstrings','glutes','calves','adductors']);

const cases = {
  'PPL Legs (7grp)': [['quads','dominant'],['quads','isolation'],['hamstrings','dominant'],['hamstrings','isolation'],['hamstrings','glutes'],['calves','gastrocnemius'],['adductors','all']],
  'Legs A (squat-focus)': [['quads','dominant'],['quads','dominant'],['quads','isolation'],['hamstrings','isolation'],['hamstrings','dominant'],['hamstrings','glutes'],['calves','gastrocnemius'],['adductors','all']],
  'Quad-focus min (6grp)': [['quads','dominant'],['quads','dominant'],['quads','isolation'],['hamstrings','dominant'],['calves','gastrocnemius'],['adductors','all']],
  'Ham-focus (4grp)': [['hamstrings','isolation'],['hamstrings','dominant'],['hamstrings','glutes'],['quads','dominant']],
  'Minimal (2grp)': [['quads','dominant'],['hamstrings','dominant']],
};

let pass=0, fail=0;
function ok(c, msg){ if(c){pass++; console.log('  \u2713 '+msg);} else {fail++; console.log('  \u2717 '+msg);} }

for (const [name, groups] of Object.entries(cases)){
  if (sandbox.resetVarietySeed) sandbox.resetVarietySeed(12345);
  if (sandbox.resetAngleTracker) sandbox.resetAngleTracker();
  const exs = pick(groups, 'gym', [], 'muscle', 60, 'advanced', 'male', 0, new Set());
  ok(exs.length >= 6, name+': \u0639\u062f\u062f \u0627\u0644\u062a\u0645\u0627\u0631\u064a\u0646 = '+exs.length+' (\u2265 6)');
  const nonLeg = exs.filter(e => !LEG.has(e.grp) && !(e.grp==='back' && e.sub==='lower') && e.grp!=='core' && e.grp!=='abs');
  ok(nonLeg.length === 0, name+': \u0643\u0644 \u0627\u0644\u062a\u0645\u0627\u0631\u064a\u0646 \u0623\u0631\u062c\u0644 ('+nonLeg.map(e=>e.grp+':'+e.n).join(', ')+')');
}

console.log('\n\u2550\u2550\u2550\u2550\u2550 \u0646\u062a\u064a\u062c\u0629 \u064a\u0648\u0645 \u0627\u0644\u0623\u0631\u062c\u0644: '+pass+' \u0646\u062c\u062d / '+fail+' \u0641\u0634\u0644 \u2550\u2550\u2550\u2550\u2550');
if (fail) process.exit(1);
