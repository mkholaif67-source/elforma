'use strict';
// Renders plan prices dynamically from /api/plans for BOTH currencies so any
// admin price edits appear instantly. HTML values act only as fallbacks.
(function () {
  function guessTZ() {
    try { return (Intl.DateTimeFormat().resolvedOptions().timeZone === 'Africa/Cairo') ? 'EGP' : 'USD'; }
    catch (e) { return 'EGP'; }
  }
  function perMonth(p, usd) {
    if (p.months <= 1) return p.tagline || '\u0645\u0631\u0648\u0646\u0629 \u0643\u0627\u0645\u0644\u0629';
    if (!usd) return p.tagline || ('\u2248 ' + Math.round(p.price_egp / p.months) + ' \u062c.\u0645 / \u0634\u0647\u0631');
    var pm = Math.round(p.price_usd / p.months);
    return '\u2248 $' + pm + ' / \u0634\u0647\u0631' + (p.best ? ' \u00b7 \u0623\u0631\u062e\u0635 \u0633\u0639\u0631 \u0634\u0647\u0631\u064a' : '');
  }
  function apply(plans, cur) {
    var usd = cur === 'USD';
    var by = {}; plans.forEach(function (p) { by[p.code] = p; });
    document.querySelectorAll('.price[data-plan]').forEach(function (card) {
      var p = by[card.getAttribute('data-plan')]; if (!p) return;
      var a = card.querySelector('.anchor'), amt = card.querySelector('.amt'),
          permo = card.querySelector('.permo'), save = card.querySelector('.save');
      var price = usd ? p.price_usd : p.price_egp;
      var anchor = usd ? p.anchor_usd : p.anchor_egp;
      if (a) a.textContent = usd ? ('$' + anchor) : (anchor + ' \u062c.\u0645');
      if (amt) amt.innerHTML = usd ? (price + ' <span class="cur">$</span>') : (price + ' <span class="cur">\u062c.\u0645</span>');
      if (permo) permo.textContent = perMonth(p, usd);
      if (save) { var d = anchor - price; if (d > 0) { save.textContent = '\u062a\u0648\u0641\u0651\u0631 ' + (usd ? ('$' + d) : (d + ' \u062c.\u0645')); save.style.display = ''; } else { save.style.display = 'none'; } }
      if (p.badge) { var be = card.querySelector('.best'), bd = card.querySelector('.badge'); if (be) be.textContent = ' ' + p.badge; else if (bd) bd.textContent = p.badge; }
    });
    try {
      var ld = document.querySelector('script[type="application/ld+json"]');
      if (ld && by.m1) { var j = JSON.parse(ld.textContent); if (j.offers) { j.offers.price = String(usd ? by.m1.price_usd : by.m1.price_egp); j.offers.priceCurrency = usd ? 'USD' : 'EGP'; } ld.textContent = JSON.stringify(j); }
    } catch (e) {}
  }
  fetch('/api/plans').then(function (r) { return r.json(); }).then(function (d) {
    if (!d || !d.plans) return;
    var cur = (d.geo && d.geo.currency) || guessTZ();
    apply(d.plans, cur);
  }).catch(function () {});
})();
