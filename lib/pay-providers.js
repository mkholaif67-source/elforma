'use strict';
// Production payment-provider integrations (Paymob card + PayPal), dependency-free
// via node:https. These only run when the provider is configured with env keys;
// otherwise the API layer returns a clean "not configured" response. Network
// access is required at runtime (disabled in the dev sandbox), so these are
// wired for production and covered by graceful fallbacks in tests.
const https = require('https');
const crypto = require('crypto');
const { PAYMOB, PAYPAL } = require('./config');

function httpsJson(urlStr, { method, headers, body } = {}) {
  return new Promise((resolve, reject) => {
    let u; try { u = new URL(urlStr); } catch (e) { return reject(e); }
    const data = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const opts = {
      method: method || 'GET',
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}),
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let json = null; try { json = raw ? JSON.parse(raw) : {}; } catch (_) { json = { raw }; }
        if (res.statusCode >= 400) return reject(Object.assign(new Error('http_' + res.statusCode), { statusCode: res.statusCode, body: json }));
        resolve(json);
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('timeout')));
    if (data) req.write(data);
    req.end();
  });
}

// ---- Paymob (Accept) card flow: returns an iframe URL for the amount ----
async function paymobCheckout({ amountEgp, user, planCode, orderRef }) {
  if (!PAYMOB.enabled) throw Object.assign(new Error('paymob_not_configured'), { statusCode: 501 });
  const cents = Math.round(amountEgp * 100);
  // 1) auth token
  const auth = await httpsJson('https://accept.paymob.com/api/auth/tokens', {
    method: 'POST', body: { api_key: PAYMOB.api_key },
  });
  // 2) order
  const order = await httpsJson('https://accept.paymob.com/api/ecommerce/orders', {
    method: 'POST',
    body: {
      auth_token: auth.token, delivery_needed: false, amount_cents: cents, currency: 'EGP',
      merchant_order_id: orderRef, items: [],
    },
  });
  // 3) payment key
  const nameParts = String(user.name || 'ElForma User').split(' ');
  const pk = await httpsJson('https://accept.paymob.com/api/acceptance/payment_keys', {
    method: 'POST',
    body: {
      auth_token: auth.token, amount_cents: cents, expiration: 3600, order_id: order.id,
      currency: 'EGP', integration_id: Number(PAYMOB.integration_id),
      billing_data: {
        first_name: nameParts[0] || 'ElForma', last_name: nameParts.slice(1).join(' ') || 'User',
        email: user.email, phone_number: '+20000000000',
        apartment: 'NA', floor: 'NA', street: 'NA', building: 'NA', shipping_method: 'NA',
        postal_code: 'NA', city: 'NA', country: 'EG', state: 'NA',
      },
    },
  });
  const iframe = 'https://accept.paymob.com/api/acceptance/iframes/' + PAYMOB.iframe_id + '?payment_token=' + pk.token;
  return { iframe_url: iframe, order_id: order.id, payment_token: pk.token };
}

// ---- PayPal REST: create + capture order ----
function paypalBase() { return PAYPAL.mode === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com'; }
async function paypalToken() {
  const basic = Buffer.from(PAYPAL.client_id + ':' + PAYPAL.secret).toString('base64');
  const res = await httpsJson(paypalBase() + '/v1/oauth2/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + basic, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  return res.access_token;
}
async function paypalCreate({ amountUsd, orderRef }) {
  if (!PAYPAL.enabled) throw Object.assign(new Error('paypal_not_configured'), { statusCode: 501 });
  const token = await paypalToken();
  const order = await httpsJson(paypalBase() + '/v2/checkout/orders', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token },
    body: {
      intent: 'CAPTURE',
      purchase_units: [{ custom_id: orderRef, amount: { currency_code: 'USD', value: String(amountUsd) } }],
    },
  });
  return { id: order.id };
}
async function paypalCapture({ orderId }) {
  if (!PAYPAL.enabled) throw Object.assign(new Error('paypal_not_configured'), { statusCode: 501 });
  const token = await paypalToken();
  const cap = await httpsJson(paypalBase() + '/v2/checkout/orders/' + orderId + '/capture', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: {},
  });
  const ok = cap && cap.status === 'COMPLETED';
  return { ok, status: cap && cap.status, capture: cap };
}

// ---- Paymob webhook HMAC verification (HMAC-SHA512 over ordered fields) ----
// Prevents forged callbacks from granting paid access for free.
function verifyPaymobHmac(obj, providedHmac, secret) {
  if (!secret || !providedHmac || !obj) return false;
  const order = [
    'amount_cents', 'created_at', 'currency', 'error_occured', 'has_parent_transaction',
    'id', 'integration_id', 'is_3d_secure', 'is_auth', 'is_capture', 'is_refunded',
    'is_standalone_payment', 'is_voided', 'order.id', 'owner', 'pending',
    'source_data.pan', 'source_data.sub_type', 'source_data.type', 'success',
  ];
  let concatenated = '';
  for (const key of order) {
    let v;
    if (key === 'order.id') v = obj.order && obj.order.id;
    else if (key.indexOf('source_data.') === 0) v = obj.source_data && obj.source_data[key.split('.')[1]];
    else v = obj[key];
    if (v === true) v = 'true';
    else if (v === false) v = 'false';
    concatenated += (v === undefined || v === null) ? '' : String(v);
  }
  const expected = crypto.createHmac('sha512', String(secret)).update(concatenated).digest('hex');
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(String(providedHmac).toLowerCase());
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (_) { return false; }
}

module.exports = { paymobCheckout, paypalCreate, paypalCapture, httpsJson, verifyPaymobHmac };
