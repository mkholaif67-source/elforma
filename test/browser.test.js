'use strict';
// Real-browser end-to-end test of the full journey using Playwright + system Chromium.
// Verifies: signup -> auto-redirect into gated /app -> ef-sync hydrates & pushes
// localStorage to the server -> data survives a reload (cloud is source of truth).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ef-btest-'));
process.env.EF_DATA_DIR = TMP;
process.env.PORT = '0';
const server = require('../server');

let passed = 0, failed = 0;
function check(name, cond){ if(cond){passed++;console.log('  \u2713 '+name);} else {failed++;console.error('  \u2717 '+name);} }

(async function(){
  await new Promise((res)=>{ if(server.listening) return res(); server.on('listening',res); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args:['--no-sandbox'] });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const email = 'btest_'+Date.now()+'@gmail.com';

  console.log('\nRunning ElForma BROWSER tests...\n');

  // 1) Signup via the real form
  await page.goto(base + '/signup.html', { waitUntil:'networkidle' });
  await page.fill('#name','Browser Tester');
  await page.fill('#email', email);
  await page.fill('#password','supersecret123');
  await Promise.all([ page.waitForURL('**/app/**',{timeout:15000}).catch(()=>{}), page.click('#btn') ]);
  check('signup redirects into /app', page.url().indexOf('/app') !== -1);

  // 2) The app page actually loaded (not bounced back to login)
  check('app page loaded (not login)', page.url().indexOf('/login') === -1);
  const hasSync = await page.evaluate(()=> !!window.EFSync && !!window.EFSync.user);
  check('EFSync active with user in app', hasSync);

  // 3) Write a tracked localStorage key and confirm it reaches the server
  await page.evaluate(()=>{ localStorage.setItem('forma_plan', JSON.stringify({split:'PPL',days:6})); localStorage.setItem('EF_UNIFIED_PROFILE', JSON.stringify({goal:'muscle'})); });
  await page.waitForTimeout(2500); // allow debounced push
  const cookies = await ctx.cookies();
  const sess = cookies.find(c=>c.name==='ef_session');
  const serverState = await new Promise((resolve)=>{
    http.get({host:'127.0.0.1',port:server.address().port,path:'/api/state',headers:{Cookie:'ef_session='+sess.value}},(r)=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>resolve(JSON.parse(b)));});
  });
  check('localStorage change pushed to server', serverState.state && JSON.parse(serverState.state.forma_plan).days === 6);

  // 4) Clear localStorage, reload -> server should re-hydrate the data
  await page.evaluate(()=>{ localStorage.clear(); });
  await page.goto(base + '/app/', { waitUntil:'networkidle' });
  const rehydrated = await page.evaluate(()=> localStorage.getItem('forma_plan'));
  check('cloud re-hydrates after localStorage cleared', rehydrated && JSON.parse(rehydrated).days === 6);

  // 5) Logout guard: after logout, /app redirects to login
  await page.evaluate(()=> window.EFSync.logout());
  await page.waitForTimeout(800);
  await page.goto(base + '/app/', { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(500);
  check('after logout, app redirects to login', page.url().indexOf('/login') !== -1);

  await browser.close();
  server.close();
  try{ fs.rmSync(TMP,{recursive:true,force:true}); }catch(_){}
  console.log('\n'+passed+' passed, '+failed+' failed\n');
  process.exit(failed?1:0);
})().catch((e)=>{ console.error('BROWSER TEST CRASH',e); process.exit(1); });
