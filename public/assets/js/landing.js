(function(){
  'use strict';
  var y=document.getElementById('yr'); if(y) y.textContent=new Date().getFullYear();
  var b=document.getElementById('burger');
  if(b) b.addEventListener('click',function(){
    var l=document.querySelector('.nav-links');
    if(!l) return;
    l.style.display=(l.style.display==='flex')?'none':'flex';
    l.style.position='absolute';l.style.top='70px';l.style.right='0';l.style.left='0';
    l.style.flexDirection='column';l.style.background='#0b1220';l.style.padding='16px 20px';l.style.borderBottom='1px solid #1e2b45';
  });
  // Reveal on scroll (with a no-JS/no-IO failsafe so content is never stuck hidden)
  var reveals=document.querySelectorAll('.reveal');
  if(!('IntersectionObserver' in window)){ reveals.forEach(function(el){el.classList.add('in');}); }
  else{
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:.08});
    reveals.forEach(function(el){io.observe(el);});
    // Safety net: force-reveal anything still hidden shortly after load.
    setTimeout(function(){reveals.forEach(function(el){el.classList.add('in');});},2500);
  }
  // If already logged in, point nav to the app
  if(window.EFAuth){ EFAuth.me().then(function(u){ if(u){ var s=document.getElementById('navSignup'); var l=document.getElementById('navLogin'); if(s){s.textContent='افتح التطبيق';s.href='/app/';} if(l){l.textContent='حسابي';l.href='/account.html';} } }); }
})();
