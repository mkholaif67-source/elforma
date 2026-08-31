'use strict';
// Fills any [data-cms="key"] element with admin-edited content from /api/content.
// Falls back silently to the existing static text when a value is empty/missing.
(function () {
  fetch('/api/content').then(function (r) { return r.json(); }).then(function (d) {
    var c = d && d.content; if (!c) return;
    document.querySelectorAll('[data-cms]').forEach(function (el) {
      var k = el.getAttribute('data-cms'); var v = c[k];
      if (v != null && String(v).trim() !== '') el.textContent = v;
    });
  }).catch(function () {});
})();
