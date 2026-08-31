// مراجعة مؤقتة — Phase 2 عبر المستويات والأهداف + سلوك validate مع الدقائق
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..');
function loadConstants(state){
  const sb={console:{log(){}},state,MODULE_DB:{cardio:{hiit:[],liss:[]}},window:undefined};
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(root,'engine/constants.js'),'utf8'),sb,{filename:'constants.js'});
  return sb;
}
let pass=0,fail=0;
function assert(c,m){if(c){pass++;console.log('  \u2713 '+m);}else{fail++;console.log('  \u2717 '+m);}}

console.log('══ Phase 2: الوزن المرجّح عبر كل المستويات والأهداف ══');
const levels=[['beginner',3],['intermediate',4],['advanced',5]];
const goals=['muscle','cut','strength','fitness'];
for(const [exp,days] of levels){
  for(const goal of goals){
    const sb=loadConstants({exp,days,goal,recoveryScore:75,bmi:24});
    const b=sb.computeWeeklyBudget(exp,days,goal,75);
    const gsm=(mu)=>sb.getSetsForMuscle(mu,exp,days,goal,b,2);
    const c=gsm('chest').weeklyTarget,bk=gsm('back').weeklyTarget,q=gsm('quads').weeklyTarget,h=gsm('hamstrings').weeklyTarget;
    const sum=c+bk+q+h;
    const tag=exp+'/'+goal;
    assert(bk>=c,tag+': ظهر('+bk+')≥صدر('+c+')');
    assert(q>=h,tag+': كوادز('+q+')≥هام('+h+')');
    assert(sum<=b.primary+2 && sum>=b.primary-3,tag+': مجموع الأساسية('+sum+')≈الميزانية('+b.primary+')');
    assert(c>0&&bk>0&&q>0&&h>0,tag+': لا عضلة أساسية بصفر');
  }
}

console.log('\n══ تحقق validate.isHumanRest مع الدقائق (باق الجمع) ══');
const PV=require(path.join(root,'engine/validate.js'));
assert(PV.isHumanRest('3-4 دقائق')===true,'"3-4 دقائق" تُقبل (بفضل منفذ n<20 — الباق حميد هنا)');
assert(PV.isHumanRest('90 ثانية')===true,'"90 ثانية" تُقبل');
assert(PV.isHumanRest('2 دقيقة')===true,'"2 دقيقة" تُقبل');

console.log('\n══ محاكاة باق components.js:1826 مع الجمع ══');
function simAutoScale(restStr){
  const mins=restStr.match(/(\d+)\s*دقيق/);
  const secs=restStr.match(/(\d+)\s*ثانية/);
  if(mins){const t=parseInt(mins[1])*60+60;const m=Math.floor(t/60),s=t%60;return s>0?m+' دقيقة '+s+' ثانية':m+' دقائق';}
  else if(secs){const t=parseInt(secs[1])+60;return t>=60?Math.floor(t/60)+' دقيقة'+(t%60?' '+(t%60)+' ثانية':''):t+' ثانية';}
  return '2 دقيقة';
}
const r1=simAutoScale('3-4 دقائق');
console.log('    autoScale("3-4 دقائق") = "'+r1+'"');
assert(r1==='2 دقيقة','تأكيد الباق: الجمع يسقط لـfallback "2 دقيقة" (يفقد راحة المركّب الثقيل)');
const r2=simAutoScale('2 دقيقة');
console.log('    autoScale("2 دقيقة") = "'+r2+'" (المفرد يعمل صح)');

console.log('\n═════ مراجعة: '+pass+' نجح / '+fail+' ملاحظة/فشل ═════');
