/* Shared client helpers for the marketing/auth pages. */
(function () {
  'use strict';
  window.EFAuth = {
    async me() {
      try {
        const r = await fetch('/api/auth/me', { credentials: 'include' });
        const j = await r.json();
        return j.user || null;
      } catch (e) { return null; }
    },
    async signup(payload) { return post('/api/auth/signup', payload); },
    async login(payload) { return post('/api/auth/login', payload); },
    async logout() { try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch (e) {} }
  };
  async function post(url, payload) {
    let r;
    try {
      r = await fetch(url, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      return { ok: false, status: 0, data: { error: 'تعذر الاتصال بالخادم. تأكد أن الموقع مرفوع والخادم يعمل ثم حاول مرة أخرى.' } };
    }
    let j = {};
    try { j = await r.json(); } catch (e) {}
    return { ok: r.ok, status: r.status, data: j };
  }
})();
