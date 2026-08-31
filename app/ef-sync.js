/*
 * ef-sync.js — ElForma cloud sync + auth guard.
 * Loaded FIRST (in <head>) inside every /app page.
 *
 * Strategy ("نطور مش نهدم"): the training/nutrition engines keep using
 * localStorage exactly as they do today. This shim:
 *   1) requires an authenticated session (else redirect to /login.html),
 *   2) hydrates localStorage from the server BEFORE app scripts run
 *      (synchronous request guarantees ordering), so the cloud is the source
 *      of truth on load,
 *   3) intercepts writes to the whitelisted keys and pushes them to the
 *      server (debounced), giving cross-device sync + durable storage.
 */
(function () {
  'use strict';
  var PREFIXES = ['EF_', 'diet_', 'forma_'];
  var API = '';
  var user = null;

  function tracked(k) {
    if (typeof k !== 'string') return false;
    for (var i = 0; i < PREFIXES.length; i++) if (k.indexOf(PREFIXES[i]) === 0) return true;
    return false;
  }

  function syncRequest(method, url, body) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, url, false); // synchronous — only used during boot
    xhr.withCredentials = true;
    if (body != null) xhr.setRequestHeader('Content-Type', 'application/json');
    try { xhr.send(body != null ? JSON.stringify(body) : null); }
    catch (e) { return { status: 0, json: null }; }
    var json = null;
    try { json = JSON.parse(xhr.responseText); } catch (e) {}
    return { status: xhr.status, json: json };
  }

  // ---- 1) Auth gate ----
  var meRes = syncRequest('GET', API + '/api/auth/me');
  if (!meRes.json || !meRes.json.user) {
    var next = encodeURIComponent(location.pathname + location.search);
    location.replace('/login.html?next=' + next);
    // Stop the rest of the page from executing meaningfully.
    throw new Error('ef-sync: not authenticated, redirecting');
  }
  user = meRes.json.user;

  // ---- 2) Hydrate localStorage from server (server wins on load) ----
  var hydrated = false;
  try {
    var stateRes = syncRequest('GET', API + '/api/state');
    if (stateRes.json && stateRes.json.state) {
      var s = stateRes.json.state;
      // Only replace keys the server actually has; keep any local-only keys.
      for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) {
        try { window.localStorage.setItem.__ef_raw ? window.localStorage.setItem.__ef_raw.call(window.localStorage, k, s[k]) : window.localStorage.setItem(k, s[k]); } catch (e) {}
      }
      hydrated = true;
    }
  } catch (e) { /* offline-tolerant: fall back to local data */ }

  // ---- 3) Intercept writes and push (debounced) ----
  var pending = {};
  var timer = null;
  var FLUSH_MS = 1500;

  function scheduleFlush() {
    if (timer) return;
    timer = setTimeout(flush, FLUSH_MS);
  }

  function flush(sync) {
    timer = null;
    var keys = Object.keys(pending);
    if (!keys.length) return;
    var changes = pending; pending = {};
    if (sync) { syncRequest('PUT', API + '/api/state', { changes: changes }); return; }
    fetch(API + '/api/state', {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changes: changes })
    }).catch(function () {
      // Re-queue on failure so we retry on next change/flush.
      for (var i = 0; i < keys.length; i++) if (!(keys[i] in pending)) pending[keys[i]] = changes[keys[i]];
    });
  }

  var proto = window.Storage && window.Storage.prototype;
  var rawSet = proto.setItem, rawRemove = proto.removeItem, rawClear = proto.clear;

  proto.setItem = function (k, v) {
    var r = rawSet.apply(this, arguments);
    if (this === window.localStorage && tracked(k)) { pending[k] = String(v); scheduleFlush(); }
    return r;
  };
  proto.setItem.__ef_raw = rawSet;
  proto.removeItem = function (k) {
    var r = rawRemove.apply(this, arguments);
    if (this === window.localStorage && tracked(k)) { pending[k] = null; scheduleFlush(); }
    return r;
  };
  proto.clear = function () {
    if (this === window.localStorage) {
      for (var i = 0; i < this.length; i++) { var k = this.key(i); if (tracked(k)) pending[k] = null; }
      scheduleFlush();
    }
    return rawClear.apply(this, arguments);
  };

  // Flush on tab hide / navigation so nothing is lost.
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(true); });
  window.addEventListener('pagehide', function () { flush(true); });
  setInterval(function () { flush(false); }, 15000);

  // ---- Public API ----
  window.EFSync = {
    user: user,
    hydrated: hydrated,
    flush: function () { flush(false); },
    logout: function () {
      flush(true);
      fetch(API + '/api/auth/logout', { method: 'POST', credentials: 'include' })
        .then(function () { location.href = '/'; })
        .catch(function () { location.href = '/'; });
    }
  };
})();
