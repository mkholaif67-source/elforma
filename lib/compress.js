'use strict';
// ضغط ردود الـ API
//
// ليه محتاجينه
// أكبر رد في التطبيق (تاريخ التمرين) كان بيطلع ~400 كيلوبايت JSON خام.
// على شبكة موبايل مصرية دي وحدها ثانية أو اتنين انتظار قبل أي رسم على الشاشة،
// ومع ألوف المستخدمين دي فاتورة باندويدث ضخمة من غير أي فايدة.
// JSON بيتضغط بنسبة 85-95% فالضغط هو أرخص تحسين سرعة موجود.
//
// ليه wrapper مش تعديل كل sendJson
// الردود كلها بتخرج من res.writeHead + res.end مرة واحدة، فبنلف الاتنين دول بس
// ومحتاجينش نلمس ولا handler واحد. الملفات الساكنة بتتبعت streaming فمابنلمسهاش.
const zlib = require('zlib');

// تحت الحد ده الضغط بياخد وقت أكتر من اللي بيوفره
const MIN_BYTES = 1024;

function compressible(contentType) {
  return /json|text\/|javascript|xml|svg/i.test(String(contentType || ''));
}

function acceptsGzip(req) {
  return /\bgzip\b/i.test(String((req.headers && req.headers['accept-encoding']) || ''));
}

// بنلفّ الرد قبل التوجيه. لو العميل مابيقبلش gzip بنرجع من غير أي تغيير.
function enableCompression(req, res) {
  if (!acceptsGzip(req)) return res;
  const writeHead = res.writeHead.bind(res);
  const end = res.end.bind(res);
  let pending = null;

  res.writeHead = function (status, headers) {
    pending = { status: status, headers: Object.assign({}, headers || {}) };
    return res;
  };

  res.end = function (chunk, enc) {
    if (!pending) return end(chunk, enc);
    const head = pending;
    pending = null;
    const type = head.headers['Content-Type'] || head.headers['content-type'] || res.getHeader('Content-Type') || '';
    const buf = chunk == null
      ? Buffer.alloc(0)
      : (Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), enc || 'utf8'));

    if (buf.length < MIN_BYTES || !compressible(type)) {
      writeHead(head.status, head.headers);
      return end(buf);
    }

    // الضغط غير متزامن عن قصد: gzipSync كان هيقفل الـ event loop على كل رد كبير
    // وده بالظبط اللي بيحول سيرفر سريع لسيرفر بيهنج تحت الضغط.
    zlib.gzip(buf, { level: 6 }, function (err, gz) {
      if (err) {
        writeHead(head.status, head.headers);
        return end(buf);
      }
      const h = head.headers;
      delete h['Content-Length'];
      delete h['content-length'];
      h['Content-Encoding'] = 'gzip';
      h['Vary'] = h['Vary'] ? h['Vary'] + ', Accept-Encoding' : 'Accept-Encoding';
      h['Content-Length'] = gz.length;
      writeHead(head.status, h);
      end(gz);
    });
    return res;
  };

  return res;
}

module.exports = { enableCompression };
