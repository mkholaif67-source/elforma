(function(){
  'use strict';
  var C = [
    ['EG','مصر','20'],['SA','السعودية','966'],['AE','الإمارات','971'],['KW','الكويت','965'],
    ['QA','قطر','974'],['BH','البحرين','973'],['OM','عمان','968'],['JO','الأردن','962'],
    ['LB','لبنان','961'],['PS','فلسطين','970'],['SY','سوريا','963'],['IQ','العراق','964'],
    ['YE','اليمن','967'],['SD','السودان','249'],['LY','ليبيا','218'],['TN','تونس','216'],
    ['DZ','الجزائر','213'],['MA','المغرب','212'],['MR','موريتانيا','222'],['SO','الصومال','252'],
    ['DJ','جيبوتي','253'],['KM','جزر القمر','269'],['TR','تركيا','90'],['US','الولايات المتحدة','1'],
    ['CA','كندا','1'],['GB','المملكة المتحدة','44'],['FR','فرنسا','33'],['DE','ألمانيا','49'],
    ['IT','إيطاليا','39'],['ES','إسبانيا','34'],['NL','هولندا','31'],['SE','السويد','46'],
    ['CH','سويسرا','41'],['RU','روسيا','7'],['IN','الهند','91'],['PK','باكستان','92'],
    ['ID','إندونيسيا','62'],['MY','ماليزيا','60'],['CN','الصين','86'],['JP','اليابان','81'],
    ['AU','أستراليا','61'],['BR','البرازيل','55'],['NG','نيجيريا','234'],['ZA','جنوب أفريقيا','27'],
    ['KE','كينيا','254'],['ET','إثيوبيا','251'],['GR','اليونان','30'],['UA','أوكرانيا','380']
  ];
  function flag(cc){ try{ return cc.toUpperCase().replace(/./g,function(ch){return String.fromCodePoint(127397+ch.charCodeAt(0));}); }catch(e){ return ''; } }
  window.EFCountries = C.map(function(x){ return {code:x[0], name:x[1], dial:x[2], flag:flag(x[0])}; });
  window.EFPhone = {
    fill: function(sel, defCode){
      defCode = defCode || 'EG';
      var html='';
      window.EFCountries.forEach(function(c){
        html += '<option value="'+c.dial+'" data-cc="'+c.code+'"'+(c.code===defCode?' selected':'')+'>'+c.name+' (+'+c.dial+')</option>';
      });
      sel.innerHTML = html;
    },
    build: function(dial, national){
      national = String(national||'').replace(/[^0-9]/g,'').replace(/^0+/,'');
      if(!national) return '';
      return '+' + String(dial).replace(/[^0-9]/g,'') + national;
    }
  };
})();
