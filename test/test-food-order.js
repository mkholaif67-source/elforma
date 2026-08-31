const h=require('../lib/nutrition-engine-host.js');
function names(arr){return arr.map(f=>f.nameAr);}
function run(){
  const prot=h.searchFoods({category:'protein'});
  console.log('PROTEIN top10:', names(prot.slice(0,10)));
  console.log('PROTEIN last6:', names(prot.slice(-6)));
  const veg=h.searchFoods({category:'veggie'});
  console.log('VEGGIE top10:', names(veg.slice(0,10)));
  console.log('VEGGIE last6:', names(veg.slice(-6)));
  const carb=h.searchFoods({category:'carb'});
  console.log('CARB top8:', names(carb.slice(0,8)));
  const fruit=h.searchFoods({category:'fruit'});
  console.log('FRUIT top8:', names(fruit.slice(0,8)));
  // search must still find rare items
  console.log('SEARCH جمبري:', names(h.searchFoods({query:'جمبري'})));
  console.log('SEARCH سلمون:', names(h.searchFoods({query:'سلمون'})));
  console.log('SEARCH افوكادو:', names(h.searchFoods({query:'افوكادو'})));
  // pickle must NOT be flagged rare (مخلل vs مخ)
  const snack=h.searchFoods({query:'مخلل'});
  console.log('SEARCH مخلل:', names(snack));
  // كابوتشا و بط must be common not rare
  console.log('SEARCH كابوتشا:', names(h.searchFoods({query:'كابوتشا'})));
  console.log('SEARCH بط:', names(h.searchFoods({query:'بط'})));
}
try{run();}catch(e){console.error('ERR',e && e.stack || e);process.exit(1);}
