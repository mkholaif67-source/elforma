/* ElForma toast notifications — tiny, dependency-free. Usage: EFToast.show('msg', 'ok'|'err'|'info') */
(function () {
  'use strict';
  var wrap;
  function ensure() {
    if (wrap) return wrap;
    wrap = document.createElement('div');
    wrap.className = 'ef-toasts';
    document.body.appendChild(wrap);
    return wrap;
  }
  function show(msg, type, ms) {
    ensure();
    var t = document.createElement('div');
    t.className = 'ef-toast ' + (type || 'info');
    var icon = type === 'ok' ? '' : type === 'err' ? '' : '';
    t.innerHTML = '<span class="ic">' + icon + '</span><span>' + String(msg) + '</span>';
    wrap.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('in'); });
    var life = ms || 3600;
    setTimeout(function () {
      t.classList.remove('in');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 300);
    }, life);
  }
  window.EFToast = { show: show, ok: function (m, ms) { show(m, 'ok', ms); }, err: function (m, ms) { show(m, 'err', ms); }, info: function (m, ms) { show(m, 'info', ms); } };
})();
