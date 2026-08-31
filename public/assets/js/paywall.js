/* ElForma paywall — free users get a preview only, paid users get everything.
   Self-contained: no dependencies, injects its own CSS + floating CTA.
   - Workout dashboard: shows Day 1 only, blurs/locks the other day tabs.
   - Diet dashboard: shows first 2 meals only, blurs the rest.
   - Both: locks the "download plan" buttons (any #dlPlan / DASH.downloadPlan).
   - Adds a dismissible bottom-side CTA encouraging subscription. */
(function () {
  'use strict';

  var PATH = location.pathname || '';
  var IS_DIET = /\/diet\//.test(PATH);
  var IS_WORKOUT = /\/workout\//.test(PATH);
  if (!IS_DIET && !IS_WORKOUT) return;

  var CHECKOUT = '/checkout.html?plan=m3';
  var DIET_PREVIEW_MEALS = 2; // number of meals shown for free
  var isPaid = false;
  var obs = null;
  var root = null;
  var scheduled = false;

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  // --- 1) Decide subscription status ------------------------------------
  fetch('/api/auth/me', { credentials: 'include' })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      var sub = j && j.subscription;
      // Trust the server-computed entitlement (handles expiry); fallback for old responses.
      isPaid = (sub && typeof sub.active === 'boolean')
        ? sub.active
        : !!(sub && sub.plan && sub.plan !== 'free' &&
          (sub.status === 'active' || sub.status === 'trialing'));
      if (!isPaid) ready(activate);
    })
    .catch(function () { /* on network error stay permissive (don't lock payers) */ });

  // --- 2) Activate the gate --------------------------------------------
  function activate() {
    injectCSS();
    injectCTA();
    installDownloadLock();
    root = document.getElementById('dashRoot') || document.body;
    apply();
    obs = new MutationObserver(schedule);
    obs.observe(root, { childList: true, subtree: true });
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () { scheduled = false; apply(); });
  }

  function apply() {
    if (isPaid) return;
    if (obs) obs.disconnect();
    try { if (IS_WORKOUT) gateWorkout(); else gateDiet(); } catch (e) {}
    if (obs) obs.observe(root, { childList: true, subtree: true });
  }

  // --- 3) Workout: day 1 only, blur the other day tabs ------------------
  function gateWorkout() {
    try {
      if (typeof window.SEL === 'number' && window.SEL > 0 && typeof window.render === 'function') {
        window.SEL = 0; window.render();
      }
    } catch (e) {}
    var tabs = document.querySelectorAll('.daytab, .wday');
    for (var i = 0; i < tabs.length; i++) {
      var el = tabs[i];
      var di = parseInt(el.getAttribute('data-i'), 10);
      if (isNaN(di) || di <= 0) continue;
      if (el.classList.contains('ef-locked')) continue;
      el.classList.add('ef-locked', 'ef-blur');
    }
  }

  // --- 4) Diet: first 2 meals only, blur the rest ----------------------
  function gateDiet() {
    var meals = root.querySelectorAll('.meal');
    for (var i = 0; i < meals.length; i++) {
      var m = meals[i];
      if (i < DIET_PREVIEW_MEALS) continue;
      if (m.classList.contains('ef-locked')) continue;
      m.classList.add('ef-locked', 'ef-blur');
      m.style.pointerEvents = 'none';
      if (i === DIET_PREVIEW_MEALS) {
        var ov = document.createElement('div');
        ov.className = 'ef-lock-strip';
        ov.innerHTML = '\u0628\u0627\u0642\u064A \u0648\u062C\u0628\u0627\u062A \u064A\u0648\u0645\u0643 \u0645\u062A\u0627\u062D\u0629 \u0644\u0644\u0645\u0634\u062A\u0631\u0643\u064A\u0646 ' +
          '<a href="' + CHECKOUT + '">\u0641\u0639\u0651\u0644 \u0627\u0634\u062A\u0631\u0627\u0643\u064A</a>';
        m.parentNode.insertBefore(ov, m);
      }
    }
  }

  // --- 5) Lock the download buttons (works for both apps) --------------
  function installDownloadLock() {
    document.addEventListener('click', function (e) {
      if (isPaid) return;
      var t = e.target;
      if (!t || !t.closest) return;
      var hit = t.closest('#dlPlan, [id="dlPlan"], .pbtn.dl, [onclick*="downloadPlan"]');
      if (!hit) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      lockToast();
    }, true);
  }

  // --- 6) UI: floating CTA + toast ------------------------------------
  function injectCTA() {
    if (document.getElementById('ef-cta')) return;
    var box = document.createElement('div');
    box.id = 'ef-cta';
    box.innerHTML =
      '<button class="ef-cta-min" id="ef-cta-min" title="\u0639\u0631\u0636">\u2726</button>' +
      '<div class="ef-cta-card">' +
      '<button class="ef-cta-x" id="ef-cta-x" aria-label="\u0625\u063A\u0644\u0627\u0642">\u00D7</button>' +
      '<div class="ef-cta-ttl">\u062F\u064A \u0645\u0639\u0627\u064A\u0646\u0629 \u0645\u0646 \u062E\u0637\u062A\u0643</div>' +
      '<div class="ef-cta-sub">\u0641\u0639\u0651\u0644 \u0627\u0634\u062A\u0631\u0627\u0643\u0643 \u0648\u0627\u0633\u062A\u0641\u062F \u0628\u062C\u0645\u064A\u0639 \u0627\u0644\u0645\u0645\u064A\u0632\u0627\u062A</div>' +
      '<a class="ef-cta-btn" href="' + CHECKOUT + '">\u0641\u0639\u0651\u0644 \u0627\u0634\u062A\u0631\u0627\u0643\u064A</a>' +
      '</div>';
    document.body.appendChild(box);
    document.getElementById('ef-cta-x').onclick = function () { box.classList.add('ef-min'); };
    document.getElementById('ef-cta-min').onclick = function () { box.classList.remove('ef-min'); };
  }

  function lockToast() {
    var old = document.getElementById('ef-toast');
    if (old) old.parentNode.removeChild(old);
    var t = document.createElement('div');
    t.id = 'ef-toast';
    t.innerHTML = '\u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u062E\u0637\u0629 \u0645\u062A\u0627\u062D \u0644\u0644\u0645\u0634\u062A\u0631\u0643\u064A\u0646 &nbsp;' +
      '<a href="' + CHECKOUT + '">\u0641\u0639\u0651\u0644 \u0627\u0634\u062A\u0631\u0627\u0643\u064A</a>';
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('ef-show'); }, 10);
    setTimeout(function () { t.classList.remove('ef-show'); }, 4200);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 4700);
  }

  // --- 7) Styles ------------------------------------------------------
  function injectCSS() {
    if (document.getElementById('ef-paywall-css')) return;
    var s = document.createElement('style');
    s.id = 'ef-paywall-css';
    s.textContent = [
      '.ef-blur{filter:blur(6px);opacity:.55;user-select:none;position:relative;transition:filter .2s}',
      '.ef-lock-strip{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;text-align:center;margin:12px 16px;padding:12px 14px;border:1px dashed #22d3a6;border-radius:14px;background:rgba(34,211,166,.08);color:#e8eefc;font-family:Cairo,sans-serif;font-weight:700;font-size:14px}',
      '.ef-lock-strip a{background:#22d3a6;color:#04121c;text-decoration:none;border-radius:999px;padding:6px 14px;font-weight:800;white-space:nowrap}',
      '#ef-cta{position:fixed;right:16px;bottom:20px;z-index:100000;font-family:Cairo,sans-serif;direction:rtl}',
      '#ef-cta .ef-cta-card{width:280px;max-width:calc(100vw - 32px);background:linear-gradient(150deg,#111a2e,#0d1526);border:1px solid #22d3a6;border-radius:18px;padding:16px 16px 15px;box-shadow:0 18px 44px -14px rgba(0,0,0,.75);position:relative;animation:efPop .35s ease}',
      '@keyframes efPop{from{transform:translateY(14px);opacity:0}to{transform:none;opacity:1}}',
      '#ef-cta .ef-cta-x{position:absolute;top:8px;left:10px;background:transparent;border:none;color:#9fb0cc;font-size:20px;line-height:1;cursor:pointer}',
      '#ef-cta .ef-cta-ttl{color:#22d3a6;font-weight:800;font-size:15px;margin-bottom:6px;padding-left:18px}',
      '#ef-cta .ef-cta-sub{color:#c7d2e6;font-size:12.5px;line-height:1.6;margin-bottom:12px}',
      '#ef-cta .ef-cta-btn{display:block;text-align:center;background:linear-gradient(90deg,#22d3a6,#3b82f6);color:#04121c;text-decoration:none;font-weight:800;font-size:14px;border-radius:12px;padding:10px}',
      '#ef-cta .ef-cta-min{display:none;width:52px;height:52px;border-radius:50%;background:linear-gradient(150deg,#22d3a6,#3b82f6);color:#04121c;border:none;font-size:22px;cursor:pointer;box-shadow:0 12px 30px -8px rgba(0,0,0,.7)}',
      '#ef-cta.ef-min .ef-cta-card{display:none}',
      '#ef-cta.ef-min .ef-cta-min{display:block}',
      '#ef-toast{position:fixed;left:50%;bottom:26px;transform:translate(-50%,20px);z-index:100001;background:#111a2e;border:1px solid #22d3a6;color:#e8eefc;font-family:Cairo,sans-serif;font-weight:700;font-size:13.5px;border-radius:999px;padding:10px 18px;box-shadow:0 14px 34px -10px rgba(0,0,0,.7);opacity:0;transition:.25s;display:flex;align-items:center;gap:6px;direction:rtl}',
      '#ef-toast.ef-show{opacity:1;transform:translate(-50%,0)}',
      '#ef-toast a{background:#22d3a6;color:#04121c;text-decoration:none;border-radius:999px;padding:4px 12px;font-weight:800}',
      '@media(max-width:520px){#ef-cta{right:10px;bottom:14px}}'
    ].join('\n');
    document.head.appendChild(s);
  }
})();
