'use strict';
// Regression test for Fix #3: the shareable release archive must NEVER carry
// secrets or a real database, while still including the app + a safe template.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ef-release-')), 'release.zip');

let pass = 0, fail = 0;
function check(name, cond) { if (cond) { pass++; console.log('  \u2713 ' + name); } else { fail++; console.log('  \u2717 ' + name); } }

console.log('[release hygiene]');

// Build the archive with the official script.
execSync('bash scripts/make-release.sh ' + JSON.stringify(OUT), { cwd: ROOT, stdio: 'pipe' });
check('release archive is produced', fs.existsSync(OUT));

// List its contents.
const listing = execSync('unzip -Z1 ' + JSON.stringify(OUT), { encoding: 'utf8' })
  .split('\n').map((s) => s.trim()).filter(Boolean);

const has = (re) => listing.some((f) => re.test(f));

// Must NOT contain any secret / database / local artifact.
check('no real .env in archive', !listing.some((f) => f === '.env' || f.endsWith('/.env')));
check('no .secret in archive', !has(/(^|\/)\.secret$/));
check('no .db files in archive', !has(/\.db($|-wal$|-shm$)/));
check('no data/ directory in archive', !has(/(^|\/)data\//));
check('no node_modules in archive', !has(/(^|\/)node_modules\//));

// Must still contain the app and the safe template.
check('server.js is included', has(/(^|\/)server\.js$/));
check('api/ is included', has(/(^|\/)api\//));
check('lib/ is included', has(/(^|\/)lib\//));
check('.env.example (safe template) is included', has(/(^|\/)\.env\.example$/));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
