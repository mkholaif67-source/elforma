/* ElForma floating WhatsApp support button + shared public config loader. */
(function () {
  'use strict';
  var cfgPromise = null;
  function loadConfig() {
    if (cfgPromise) return cfgPromise;
    cfgPromise = fetch('/api/plans').then(function (r) { return r.json(); }).catch(function () { return null; });
    return cfgPromise;
  }
  window.EFConfig = { load: loadConfig };

  function mount(support) {
    if (!support || !support.whatsapp) return;
    if (document.querySelector('.ef-wa')) return;
    var digits = String(support.whatsapp).replace(/\D+/g, '');
    if (!digits) return;
    var msg = encodeURIComponent('أهلا، عاوز استفسر عن ElForma');
    var a = document.createElement('a');
    a.className = 'ef-wa';
    a.href = 'https://wa.me/' + digits + '?text=' + msg;
    a.target = '_blank'; a.rel = 'noopener';
    a.setAttribute('aria-label', 'تواصل معنا على واتساب');
    a.innerHTML = '<svg viewBox="0 0 32 32" width="28" height="28" fill="#fff"><path d="M16 3C9.4 3 4 8.4 4 15c0 2.1.6 4.1 1.6 5.9L4 29l8.3-1.6c1.7.9 3.6 1.4 5.7 1.4 6.6 0 12-5.4 12-12S22.6 3 16 3zm0 21.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-4.9 1 1-4.8-.3-.4C5.5 18.9 5 17 5 15 5 9 9.9 4.1 16 4.1S27 9 27 15s-4.9 9.8-11 9.8zm5.6-7.3c-.3-.2-1.8-.9-2-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.5-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.2 5 4.5.7.3 1.2.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.2-.3-.2-.6-.4z"/></svg>';
    document.body.appendChild(a);
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadConfig().then(function (c) {
      // fallback: show button even when API is unavailable
      // replace 201000000000 with your real WhatsApp number
      mount(c && c.support ? c.support : { whatsapp: '201000000000' });
    });
  });
})();
