#!/usr/bin/env node
/*
 * build.js — يجمع المشروع المقسم في ملف HTML واحد قائم بذاته.
 * الاستخدام:  node build.js
 * المخرج:    dist/diet_engine_final.html
 *
 * الفكرة: نفس index.html، لكن نستبدل وسوم <link> بمحتوى ملفات CSS،
 * ووسوم <script src> بمحتوى ملفات JS مدمجة بنفس الترتيب.
 * لا يتم تعديل أي سطر منطقي — مجرد دمج.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const lines = html.split('\n');

const cssFiles = [];
const jsFiles = [];
for (const l of lines) {
  let m = l.match(/<link rel="stylesheet" href="(?!https?:)([^"?]+\.css)(?:\?[^"]*)?">/);
  if (m) cssFiles.push(m[1]);
  m = l.match(/<script src="(?!https?:)([^"?]+\.js)(?:\?[^"]*)?"><\/script>/);
  if (m) jsFiles.push(m[1]);
}
console.log(`Inlining ${cssFiles.length} css + ${jsFiles.length} js files`);

const cssInline = cssFiles
  .map(f => `  <style>\n${fs.readFileSync(path.join(ROOT, f), 'utf8')}\n  </style>`)
  .join('\n');
const jsInline =
  '  <script>\n' +
  jsFiles.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n') +
  '\n  </script>';

const out = [];
let cssDone = false, jsDone = false;
for (const l of lines) {
  if (/<link rel="stylesheet" href="(?!https?:)[^"?]+\.css(?:\?[^"]*)?">/.test(l)) {
    if (!cssDone) { out.push(cssInline); cssDone = true; }
    continue;
  }
  if (/<script src="(?!https?:)[^"?]+\.js(?:\?[^"]*)?"><\/script>/.test(l)) {
    if (!jsDone) { out.push(jsInline); jsDone = true; }
    continue;
  }
  if (/===== Stylesheets \(modular/.test(l)) continue;
  if (/===== Application scripts \(classic/.test(l)) continue;
  out.push(l);
}

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist', 'diet_engine_final.html'), out.join('\n'));
console.log('\u2714 Wrote dist/diet_engine_final.html');
