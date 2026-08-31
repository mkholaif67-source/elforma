(function(){
  'use strict';
  // Cloud-syncs whitelisted localStorage keys with /api/state so the user's
  // plan/profile/logs follow their account across devices & browser clears.
  var PREFIXES=['EF_','diet_','forma_'];
  function allowed(k){ return typeof k==='string' && PREFIXES.some(function(p){return k.indexOf(p)===0;}); }
  var _set=localStorage.setItem.bind(localStorage);
  var _rm=localStorage.removeItem.bind(localStorage);
  var pending={}, timer=null;
  function flush(){
    timer=null;
    var changes=pending; pending={};
    if(!Object.keys(changes).length) return;
    fetch('/api/state',{method:'PUT',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({changes:changes})})
      .catch(function(){ Object.keys(changes).forEach(function(k){ if(!(k in pending)) pending[k]=changes[k]; }); });
  }
  function schedule(){ if(!timer) timer=setTimeout(flush,1200); }
  localStorage.setItem=function(k,v){ _set(k,v); if(allowed(k)){ pending[k]=String(v); schedule(); } };
  localStorage.removeItem=function(k){ _rm(k); if(allowed(k)){ pending[k]=null; schedule(); } };
  window.addEventListener('beforeunload',function(){ if(timer){ clearTimeout(timer); flush(); } });
  (async function(){
    var u=null;
    try{ var mr=await fetch('/api/auth/me',{credentials:'include'}); u=(await mr.json()).user; }catch(e){ return; }
    if(!u) return;
    var server={};
    try{ var r=await fetch('/api/state',{credentials:'include'}); if(r.ok) server=(await r.json()).state||{}; else return; }catch(e){ return; }
    var changed=false;
    Object.keys(server).forEach(function(k){ if(allowed(k) && localStorage.getItem(k)!==server[k]){ _set(k,server[k]); changed=true; } });
    var up={};
    for(var i=0;i<localStorage.length;i++){ var k=localStorage.key(i); if(allowed(k) && !(k in server)){ up[k]=localStorage.getItem(k); } }
    if(Object.keys(up).length){ try{ await fetch('/api/state',{method:'PUT',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({changes:up})}); }catch(e){} }
    var last=+(sessionStorage.getItem('ef_sync_ts')||0);
    if(changed && Date.now()-last>4000){ sessionStorage.setItem('ef_sync_ts',String(Date.now())); location.reload(); }
  })();
})();
