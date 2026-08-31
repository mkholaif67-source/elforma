(function(){
  'use strict';
  var d=document;
  var y=d.getElementById('yr'); if(y) y.textContent=new Date().getFullYear();
  var nav=d.querySelector('.nav');
  var header=d.querySelector('header');
  var sticky=d.querySelector('.sticky-cta');
  function onScroll(){
    var s=window.scrollY||window.pageYOffset;
    if(nav) nav.classList.toggle('scrolled', s>24);
    if(header) header.classList.toggle('scrolled', s>24);
    if(sticky) sticky.classList.toggle('show', s>640);
  }
  window.addEventListener('scroll',onScroll,{passive:true}); onScroll();
  // mobile menu
  var burger=d.getElementById('burger');
  var panel=d.querySelector('.mobile-panel');
  var closeBtn=d.querySelector('.mp-close');
  function openM(){ if(!panel)return; panel.classList.add('open'); if(burger)burger.setAttribute('aria-expanded','true'); d.body.style.overflow='hidden'; }
  function closeM(){ if(!panel)return; panel.classList.remove('open'); if(burger)burger.setAttribute('aria-expanded','false'); d.body.style.overflow=''; }
  if(burger) burger.addEventListener('click',openM);
  if(closeBtn) closeBtn.addEventListener('click',closeM);
  if(panel){ panel.querySelectorAll('a').forEach(function(a){ a.addEventListener('click',closeM); }); }
  // reveal on scroll (with failsafe)
  var reveals=d.querySelectorAll('.reveal');
  if(!('IntersectionObserver' in window)){ reveals.forEach(function(el){el.classList.add('in');}); }
  else{
    var io=new IntersectionObserver(function(es){es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });},{threshold:.12});
    reveals.forEach(function(el){io.observe(el);});
    setTimeout(function(){reveals.forEach(function(el){el.classList.add('in');});},2600);
  }
  // count-up numbers
  function countUp(el){
    var t=parseFloat(el.getAttribute('data-count')); if(isNaN(t)){return;}
    var suf=el.getAttribute('data-suffix')||''; var pre=el.getAttribute('data-prefix')||'';
    var dur=1500, s=null;
    function step(ts){ if(!s)s=ts; var p=Math.min((ts-s)/dur,1); var e=1-Math.pow(1-p,3); el.textContent=pre+Math.floor(e*t)+suf; if(p<1){requestAnimationFrame(step);} else {el.textContent=pre+t+suf;} }
    requestAnimationFrame(step);
  }
  var counters=d.querySelectorAll('[data-count]');
  function doCount(el){ if(el.dataset.counted) return; el.dataset.counted='1'; countUp(el); }
  if('IntersectionObserver' in window){
    var cio=new IntersectionObserver(function(es){es.forEach(function(e){ if(e.isIntersecting){ doCount(e.target); cio.unobserve(e.target); } });},{threshold:.4});
    counters.forEach(function(el){cio.observe(el);});
  } else { counters.forEach(doCount); }
  // failsafe: never leave a counter stuck on 0
  setTimeout(function(){ counters.forEach(function(el){ if(!el.dataset.counted){ el.dataset.counted='1'; el.textContent=(el.getAttribute('data-prefix')||'')+el.getAttribute('data-count')+(el.getAttribute('data-suffix')||''); } }); }, 3000);
  // hero progress ring
  var ring=d.querySelector('.ring-fg');
  if(ring){
    var Rr=parseFloat(ring.getAttribute('r'))||96; var Cc=2*Math.PI*Rr; var pct=0.78;
    ring.style.strokeDasharray=Cc; ring.style.strokeDashoffset=Cc;
    var fillRing=function(){ ring.style.strokeDashoffset=Cc*(1-pct); };
    if('IntersectionObserver' in window){ var rio=new IntersectionObserver(function(es){es.forEach(function(e){ if(e.isIntersecting){ fillRing(); rio.unobserve(e.target); } });},{threshold:.35}); rio.observe(ring); }
    else { fillRing(); }
  }
  // logged-in rewire
  if(window.EFAuth){ EFAuth.me().then(function(u){ if(u){ var sg=d.getElementById('navSignup'), lg=d.getElementById('navLogin'); if(sg){sg.textContent='افتح التطبيق \u2192'; sg.href='/app/';} if(lg){lg.textContent='حسابي'; lg.href='/account.html';} } }); }
})();
