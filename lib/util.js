'use strict';
// Small dependency-free HTTP helpers.
const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml; charset=utf-8',
  '.pdf': 'application/pdf'
};

function mimeFor(p) {
  return MIME[path.extname(p).toLowerCase()] || 'application/octet-stream';
}

function sendJson(res, status, obj, extraHeaders) {
  const body = JSON.stringify(obj);
  res.writeHead(status, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  }, extraHeaders || {}));
  res.end(body);
}

function sendText(res, status, text, contentType) {
  res.writeHead(status, { 'Content-Type': contentType || 'text/plain; charset=utf-8' });
  res.end(text);
}

// Read + parse a JSON request body with a hard size cap.
function readJsonBody(req, maxBytes) {
  maxBytes = maxBytes || 1024 * 1024; // 1MB default
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error('payload_too_large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (e) { reject(Object.assign(new Error('invalid_json'), { statusCode: 400 })); }
    });
    req.on('error', reject);
  });
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx < 0) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

function serializeCookie(name, value, opts) {
  opts = opts || {};
  let str = name + '=' + encodeURIComponent(value);
  if (opts.maxAge != null) str += '; Max-Age=' + Math.floor(opts.maxAge);
  str += '; Path=' + (opts.path || '/');
  if (opts.httpOnly !== false) str += '; HttpOnly';
  str += '; SameSite=' + (opts.sameSite || 'Lax');
  if (opts.secure) str += '; Secure';
  return str;
}

// Very small static file server with path-traversal protection.
function serveStatic(res, rootDir, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel.endsWith('/')) rel += 'index.html';
  const full = path.normalize(path.join(rootDir, rel));
  if (!full.startsWith(path.normalize(rootDir))) {
    sendText(res, 403, 'Forbidden');
    return true;
  }
  let stat;
  try { stat = fs.statSync(full); } catch (e) { return false; }
  if (stat.isDirectory()) return serveStatic(res, rootDir, rel.replace(/\/?$/, '/'));
  const stream = fs.createReadStream(full);
  res.writeHead(200, {
    'Content-Type': mimeFor(full),
    'Content-Length': stat.size,
    'Cache-Control': mimeFor(full).startsWith('text/html') ? 'no-cache' : 'public, max-age=3600'
  });
  stream.pipe(res);
  stream.on('error', () => { try { res.destroy(); } catch (_) {} });
  return true;
}

function isEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

function normalizePhone(s) {
  if (typeof s !== 'string') return null;
  let t = s.trim().replace(/[\s\-().]/g, '');
  if (t.startsWith('00')) t = '+' + t.slice(2);
  if (!t.startsWith('+')) return null;
  const digits = t.slice(1);
  if (!/^[0-9]{7,15}$/.test(digits)) return null;
  return '+' + digits;
}
function isPhone(s) { return normalizePhone(s) != null; }

module.exports = {
  mimeFor, sendJson, sendText, readJsonBody,
  parseCookies, serializeCookie, serveStatic, isEmail,
  normalizePhone, isPhone
};
