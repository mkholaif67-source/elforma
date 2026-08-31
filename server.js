'use strict';
// ElForma full-stack server — dependency-free (Node built-ins only).
// Serves: marketing site (public/), the app (app/, auth-gated), and JSON API.
const http = require('http');
const path = require('path');
const fs = require('fs');
const { parseCookies, sendJson, sendText, serveStatic } = require('./lib/util');
const { enableCompression } = require('./lib/compress');
const authApi = require('./api/auth');
const stateApi = require('./api/state');
const accountApi = require('./api/account');
const payApi = require('./api/pay');
const verifyApi = require('./api/verify');
const adminApi = require('./api/admin');
const reviewsApi = require('./api/reviews');
const planApi = require('./api/plan');
const workoutApi = require('./api/workout');
const mobileApi = require('./api/mobile');
const shareApi  = require('./api/share');
const auth = require('./lib/auth');
const db = require('./lib/db');
const commerce = require('./lib/commerce');
const { checkAccess } = auth;

const PORT = process.env.PORT || 8000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const APP_DIR = path.join(ROOT, 'app');
const DATA_DIR = process.env.EF_DATA_DIR || path.join(ROOT, 'data');

function clientIp(req) {
  // Only trust X-Forwarded-For behind a known proxy (EF_TRUST_PROXY=1),
  // otherwise clients could spoof it to bypass rate limits.
  if (process.env.EF_TRUST_PROXY === '1') {
    const xf = req.headers['x-forwarded-for'];
    if (xf) return String(xf).split(',')[0].trim();
  }
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://www.paypal.com https://www.paypalobjects.com https://accept.paymob.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://accept.paymob.com https://www.paypal.com https://api-m.paypal.com",
    "frame-src 'self' https://accept.paymob.com https://www.paypal.com https://www.sandbox.paypal.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'"
  ].join('; '));
  if (process.env.EF_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

/* [FIX M12 — مفيش لوج منظّم ولا معرّف للطلب]
   المشكلة المثبتة: كل اللي كان موجود هو console.error('[server]', err) وبس.
   لما يوصلك شكوى "الخطة مافتحتش الساعة 4"، مافيش طريقة تربط الشكوى
   دي بسطر لوج معيّن، ولا تعرف الطلب أخد قد إيه، ولا رجّع كود إيه.

   الحل هنا متعمّد إنه بسيط ومن غير مكتبات (المشروع zero-dependency):
     • كل طلب له requestId عشوائي بيرجع في هيدر X-Request-Id.
     • سطر واحد JSON لكل طلب API: المسار، الطريقة، الكود، المدة بالملي‌ثانية.
     • الأخطاء بتطلع بنفس الـ requestId، فالمستخدم يقدر يبعتلك الرقم وتلاقيه.

   مابنسجّلش أبدًا: الكوكيز، التوكنات، الباودي، الإيميل، أو الـ query string كاملة.
   الـ IP بيتقطع لآخر octet (خصوصية) وبيقفل خالص بـ EF_LOG_IP=0. */
const LOG_REQUESTS = process.env.EF_LOG_REQUESTS !== '0';
const LOG_IP = process.env.EF_LOG_IP !== '0';

function newRequestId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function maskIp(ip) {
  if (!LOG_IP || !ip) return null;
  if (ip.indexOf('.') > -1) return ip.split('.').slice(0, 3).join('.') + '.x';
  return ip.split(':').slice(0, 3).join(':') + ':x';   // IPv6
}

function logLine(fields) {
  try { console.log(JSON.stringify(fields)); }
  catch (_) { console.log('[log] unserialisable entry'); }
}

const server = http.createServer(async (req, res) => {
  const ip = clientIp(req);
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;
  securityHeaders(res);

  // [FIX M12] معرّف الطلب: بيتحط على الرد قبل أي حاجة، وبيتحط على req
  // عشان أي معالج جوّا يقدر يستخدمه لو احتاج.
  const requestId = newRequestId();
  req.requestId = requestId;
  const startedAt = process.hrtime.bigint();
  try { res.setHeader('X-Request-Id', requestId); } catch (_) { /* headers already sent */ }

  if (LOG_REQUESTS && pathname.startsWith('/api/')) {
    res.on('finish', function () {
      const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
      logLine({
        t: new Date().toISOString(),
        lvl: res.statusCode >= 500 ? 'error' : (res.statusCode >= 400 ? 'warn' : 'info'),
        rid: requestId,
        method: req.method,
        path: pathname,               // المسار بس — مفيش query string
        status: res.statusCode,
        ms: Math.round(ms * 10) / 10,
        ip: maskIp(ip),
      });
    });
  }

  try {
    // ---------- API ----------
    if (pathname.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store');
      // ردود الـ API بتتضغط لو العميل بيقبل gzip: أكبر رد (تاريخ التمرين)
      // بينزل من مئات الكيلوبايت لعشرات، وده أكبر فرق في سرعة الشاشة على شبكة موبايل.
      enableCompression(req, res);
      if (pathname === '/api/health') return sendJson(res, 200, { ok: true, ts: Date.now() });

      if (req.method === 'POST' && pathname === '/api/auth/signup') return void (await authApi.signup(req, res, ip));
      if (req.method === 'POST' && pathname === '/api/auth/login') return void (await authApi.login(req, res, ip));
      if (req.method === 'POST' && pathname === '/api/auth/google') return void (await authApi.googleAuth(req, res, ip));
      if (req.method === 'POST' && pathname === '/api/auth/logout') return void (await authApi.logout(req, res));
      if (req.method === 'GET' && pathname === '/api/auth/me') return void (await authApi.me(req, res));

      if (req.method === 'GET' && pathname === '/api/state') return void (await stateApi.getAll(req, res));
      if (req.method === 'PUT' && pathname === '/api/state') return void (await stateApi.put(req, res));

      if (req.method === 'GET' && pathname === '/api/account/export') return void (await accountApi.exportData(req, res));
      if (req.method === 'POST' && pathname === '/api/account/delete') return void (await accountApi.deleteAccount(req, res, ip));
      if (req.method === 'POST' && pathname === '/api/account/profile') return void (await accountApi.updateProfile(req, res, ip));
      if (req.method === 'POST' && pathname === '/api/account/password') return void (await accountApi.changePassword(req, res, ip));
      if (req.method === 'POST' && pathname === '/api/account/logout-all') return void (await accountApi.logoutAllDevices(req, res, ip));

      // ---- Commerce: plans, coupons, checkout, payments ----
      if (req.method === 'GET' && pathname === '/api/plans') return void (await payApi.plans(req, res));
      if (req.method === 'GET' && pathname === '/api/content') return void (await payApi.content(req, res));
      if (req.method === 'GET' && pathname === '/api/pay/methods') return void (await payApi.methods(req, res));
      if (req.method === 'GET' && pathname === '/api/pay/mine') return void (await payApi.mine(req, res));
      if (req.method === 'POST' && pathname === '/api/coupon/check') return void (await payApi.couponCheck(req, res, ip));
      if (req.method === 'POST' && pathname === '/api/pay/manual') return void (await payApi.manual(req, res, ip));
      if (req.method === 'POST' && pathname === '/api/pay/paymob') return void (await payApi.paymob(req, res, ip));
      if (req.method === 'POST' && pathname === '/api/pay/paymob/webhook') return void (await payApi.paymobWebhook(req, res));
      if (req.method === 'POST' && pathname === '/api/pay/paypal/create') return void (await payApi.paypalCreate(req, res));
      if (req.method === 'POST' && pathname === '/api/pay/paypal/capture') return void (await payApi.paypalCapture(req, res));

      // ---- Email verification + password reset ----
      if (req.method === 'POST' && pathname === '/api/auth/verify/send') return void (await verifyApi.sendVerification(req, res, ip));
      if (req.method === 'POST' && pathname === '/api/auth/verify') return void (await verifyApi.verify(req, res, ip));
      if (req.method === 'POST' && pathname === '/api/auth/forgot') return void (await verifyApi.forgot(req, res, ip));
      if (req.method === 'POST' && pathname === '/api/auth/reset') return void (await verifyApi.reset(req, res, ip));
      if (req.method === 'POST' && pathname === '/api/auth/phone/otp/send') return void (await verifyApi.sendPhoneOtp(req, res, ip));
      if (req.method === 'POST' && pathname === '/api/auth/phone/otp/verify') return void (await verifyApi.verifyPhoneOtp(req, res, ip));

      // ---- Reviews (public read, auth write, admin moderation) ----
      if (req.method === 'GET' && pathname === '/api/reviews') return void (await reviewsApi.list(req, res));
      if (req.method === 'GET' && pathname === '/api/reviews/mine') return void (await reviewsApi.mine(req, res));
      if (req.method === 'POST' && pathname === '/api/reviews') return void (await reviewsApi.submit(req, res, ip));
      if (req.method === 'GET' && pathname === '/api/reviews/pending') return void (await reviewsApi.pending(req, res));
      if (req.method === 'POST' && pathname === '/api/reviews/moderate') return void (await reviewsApi.moderate(req, res, ip));

      // Server-side plan computation (premium logic never leaves the server).
      //
      // These routes are intentionally NOT behind a hard access gate. Each
      // handler already checks the subscription itself (api/plan.js and
      // api/workout.js call subActive() and fall back to gatePreview()), which
      // is what powers the free teaser the paywall UI expects. Rejecting the
      // request up here with a 401/402 would delete that preview for every
      // logged-out visitor and every free account.
      if (req.method === 'POST' && pathname === '/api/plan/compute') return void (await planApi.compute(req, res, ip));
      if (req.method === 'POST' && pathname === '/api/plan/targets') return void (await planApi.targets(req, res));
      if (req.method === 'POST' && pathname === '/api/workout/compute') return void (await workoutApi.compute(req, res));

      // Native mobile persistence (no browser localStorage).
      if (req.method === 'GET' && pathname === '/api/mobile/bootstrap') return void (await mobileApi.bootstrap(req, res));
      if (req.method === 'GET' && pathname === '/api/mobile/modules') return void (await mobileApi.modules(req, res));
      // التاريخ بيتقرا على دفعات مش مرة واحدة
      if (req.method === 'GET' && pathname === '/api/mobile/history') return void (await mobileApi.history(req, res));
      // Public kill-switch for bad releases. Deliberately NOT behind auth: a
      // blocked build must be able to ask before it can even log in.
      if (req.method === 'GET' && pathname === '/api/app/version') return void (await mobileApi.appVersion(req, res));
      // المتدرب بيبلغ إن فيديو مش شغال
      if (req.method === 'POST' && pathname === '/api/app/video-report') return void (await mobileApi.reportVideo(req, res));
      if (req.method === 'PUT' && pathname === '/api/mobile/profile') return void (await mobileApi.saveProfile(req, res));
      if (req.method === 'PUT' && pathname === '/api/mobile/workout-plan') return void (await mobileApi.activatePlan(req, res));
      if (req.method === 'POST' && pathname === '/api/mobile/session/start') return void (await mobileApi.startSession(req, res));
      if (req.method === 'PUT' && pathname === '/api/mobile/session/set') return void (await mobileApi.saveSet(req, res));
      if (req.method === 'POST' && pathname === '/api/mobile/session/finish') return void (await mobileApi.finishSession(req, res));
      if (req.method === 'PUT' && pathname === '/api/mobile/nutrition') return void (await mobileApi.saveNutrition(req, res));
      if (req.method === 'PUT' && pathname === '/api/mobile/weight') return void (await mobileApi.saveWeight(req, res));
      if (req.method === 'PUT' && pathname === '/api/mobile/measurement') return void (await mobileApi.saveMeasurement(req, res));
      if (req.method === 'GET' && pathname === '/api/mobile/foods') return void (await mobileApi.foodSearch(req, res));
      if (req.method === 'GET' && pathname === '/api/mobile/food-preferences') return void (await mobileApi.foodPreferences(req, res));
      if (req.method === 'PUT' && pathname === '/api/mobile/food-preference') return void (await mobileApi.saveFoodPreference(req, res));
      if (req.method === 'GET' && pathname === '/api/mobile/exercise-history') return void (await mobileApi.exerciseHistory(req, res));
      if (req.method === 'GET' && pathname === '/api/mobile/exercise-alternatives') return void (await mobileApi.exerciseAlternatives(req, res));
      if (req.method === 'GET' && pathname === '/api/mobile/workout-history') return void (await mobileApi.workoutHistory(req, res));
      if (req.method === 'GET' && pathname === '/api/mobile/nutrition-plan') return void (await mobileApi.nutritionPlan(req, res));
      if (req.method === 'POST' && pathname === '/api/mobile/client-event') return void (await mobileApi.clientEvent(req, res));
      if (req.method === 'GET' && pathname === '/api/mobile/smart-coach') return void (await mobileApi.smartCoachGet(req, res));
      if (req.method === 'PUT' && pathname === '/api/mobile/smart-coach') return void (await mobileApi.smartCoachSet(req, res));
      if (req.method === 'POST' && pathname === '/api/mobile/nutrition/override') return void (await mobileApi.saveMealOverride(req, res));
      if (req.method === 'GET' && pathname === '/api/mobile/nutrition/overrides') return void (await mobileApi.getMealOverrides(req, res));
      if (req.method === 'POST' && pathname === '/api/mobile/trial/start') return void (await mobileApi.startTrial(req, res, ip));
      // رد المتدرب على سؤال الالتزام لما مايكونش مسجّل داتا.
      if (req.method === 'POST' && pathname === '/api/mobile/checkin') return void (await mobileApi.checkinSubmit(req, res));
      if (req.method === 'GET' && pathname === '/api/mobile/notifications') return void (await mobileApi.getNotifications(req, res));
      // ---- Push وإعدادات التطبيق الحيّة ----
      // تسجيل توكن الجهاز هو اللي بيخلي إشعار الأدمن يوصل والتطبيق مقفول.
      if (req.method === 'POST' && pathname === '/api/mobile/device/register') return void (await mobileApi.registerDevice(req, res));
      if (req.method === 'POST' && pathname === '/api/mobile/device/unregister') return void (await mobileApi.unregisterDevice(req, res));
      if (req.method === 'GET' && pathname === '/api/mobile/app-config') return void (await mobileApi.mobileAppConfig(req, res));

      // ---- Admin payment review ----
      if (req.method === 'GET' && pathname === '/api/admin/whoami') return void (await adminApi.whoami(req, res));
      if (req.method === 'GET' && pathname === '/api/admin/payments') return void (await adminApi.payments(req, res));
      if (req.method === 'POST' && pathname === '/api/admin/payment/approve') return void (await adminApi.approve(req, res, ip));
      if (req.method === 'POST' && pathname === '/api/admin/payment/reject') return void (await adminApi.reject(req, res, ip));
      if (req.method === 'GET' && pathname === '/api/admin/receipt') return void (await adminApi.receipt(req, res));
      if (req.method === 'GET' && pathname === '/api/admin/stats') return void (await adminApi.stats(req, res));
      if (req.method === 'GET' && pathname === '/api/admin/users') return void (await adminApi.users(req, res));
      if (req.method === 'POST' && pathname === '/api/admin/user/subscription') return void (await adminApi.setUserSubscription(req, res, ip));
      if (req.method === 'POST' && pathname === '/api/admin/user/delete') return void (await adminApi.deleteUser(req, res, ip));
      if (req.method === 'GET' && pathname === '/api/admin/coupons') return void (await adminApi.coupons(req, res));
      if (req.method === 'POST' && pathname === '/api/admin/coupon/upsert') return void (await adminApi.couponUpsert(req, res, ip));
      if (req.method === 'POST' && pathname === '/api/admin/coupon/toggle') return void (await adminApi.couponToggle(req, res, ip));
      if (req.method === 'POST' && pathname === '/api/admin/coupon/delete') return void (await adminApi.couponDelete(req, res, ip));
      if (req.method === 'GET' && pathname === '/api/admin/announcements') return void (await adminApi.announcementsGet(req, res));
      if (req.method === 'POST' && pathname === '/api/admin/announcements') return void (await adminApi.announcementsSave(req, res, ip));
      if (req.method === 'GET' && pathname === '/api/admin/announcements/preview') return void (await adminApi.announcementsPreview(req, res));
      if (req.method === 'GET' && pathname === '/api/admin/referrals') return void (await adminApi.referrals(req, res));
      if (req.method === 'POST' && pathname === '/api/admin/referral/create') return void (await adminApi.referralCreate(req, res, ip));
      if (req.method === 'GET' && pathname === '/api/admin/pricing') return void (await adminApi.pricingGet(req, res));
      if (req.method === 'POST' && pathname === '/api/admin/pricing') return void (await adminApi.pricingSave(req, res, ip));
      if (req.method === 'GET' && pathname === '/api/admin/videos') return void (await adminApi.videos(req, res));
      if (req.method === 'POST' && pathname === '/api/admin/video/set') return void (await adminApi.videoSet(req, res, ip));
      if (req.method === 'POST' && pathname === '/api/admin/video/remove') return void (await adminApi.videoRemove(req, res, ip));
      if (req.method === 'POST' && pathname === '/api/admin/video/reset') return void (await adminApi.videoReset(req, res, ip));
      // طابور بلاغات الفيديو
      if (req.method === 'GET' && pathname === '/api/admin/video-reports') return void (await adminApi.videoReports(req, res));
      if (req.method === 'POST' && pathname === '/api/admin/video-report/resolve') return void (await adminApi.videoReportResolve(req, res, ip));
      if (req.method === 'GET' && pathname === '/api/admin/content') return void (await adminApi.contentGet(req, res));
      if (req.method === 'GET' && pathname === '/api/admin/promo') return void (await adminApi.promoList(req, res));
      if (req.method === 'POST' && pathname === '/api/admin/promo') return void (await adminApi.promoAction(req, res, ip));
      if (req.method === 'POST' && pathname === '/api/admin/content') return void (await adminApi.contentSave(req, res, ip));

      // ---- Admin: custom subscription plans ----
      if (req.method === 'GET'  && pathname === '/api/admin/plans')       return void (await adminApi.planList(req, res));
      if (req.method === 'POST' && pathname === '/api/admin/plan/add')    return void (await adminApi.planAdd(req, res, ip));
      if (req.method === 'POST' && pathname === '/api/admin/plan/delete') return void (await adminApi.planDelete(req, res, ip));

      // ---- Promo redemption (signed-in users) ----
      if (req.method === 'POST' && pathname === '/api/promo/redeem') {
        const gate = checkAccess(parseCookies(req));
        if (gate) return sendJson(res, gate.status, { error: gate.error });
        const me = auth.currentUser(parseCookies(req));
        const body = await require('./lib/util').readJsonBody(req);
        const out = commerce.redeemPromo(me.id, body && body.code);
        return sendJson(res, out.ok ? 200 : 400, out);
      }

      // ---- Feature Flags ----
      // Reads the same feature_flags table the admin screen writes to, so the
      // public endpoint and the admin toggle can never disagree.
      if (req.method === 'GET' && pathname === '/api/features') {
        const rows = db.getAllFeatureFlags();
        const flags = { ai_nutritionist: true, ai_coach: true };
        for (const row of rows) flags[row.key] = row.value === '1';
        return sendJson(res, 200, { ok: true, features: flags });
      }
      if (req.method === 'GET' && pathname === '/api/admin/features') return void (await adminApi.featuresGet(req, res));
      if (req.method === 'POST' && pathname === '/api/admin/features') return void (await adminApi.featuresSave(req, res, ip));
      if (req.method === 'GET'  && pathname === '/api/admin/notifications') return void (await adminApi.notificationsGet(req, res));
      if (req.method === 'POST' && pathname === '/api/admin/notifications/send') return void (await adminApi.notificationsSend(req, res, ip));
      if (req.method === 'POST' && pathname === '/api/admin/notifications/delete') return void (await adminApi.notificationDelete(req, res, ip));
      if (req.method === 'POST' && pathname === '/api/admin/upload') return void (await adminApi.uploadImage(req, res, ip));
      // حالة الـPush الحقيقية (FCM مضبوط؟ كام جهاز مستعد يستقبل؟)
      if (req.method === 'GET' && pathname === '/api/admin/push/status') return void (await adminApi.pushStatus(req, res));
      // إعدادات التطبيق: الصيانة، بوّابة الإصدار، المفاتيح العامة
      if (req.method === 'GET' && pathname === '/api/admin/app-config') return void (await adminApi.appConfigGet(req, res));
      if (req.method === 'POST' && pathname === '/api/admin/app-config') return void (await adminApi.appConfigSave(req, res, ip));
      // سجل العمليات من جدول audit_log
      if (req.method === 'GET' && pathname === '/api/admin/audit') return void (await adminApi.auditLog(req, res));

      // ---- Share plan ----
      // Creating a share link requires a signed-in user (it reads THEIR plan).
      // Reading one by token is deliberately public -- that is the point.
      if (req.method === 'POST' && pathname === '/api/share/plan') {
        const gate = checkAccess(parseCookies(req));
        if (gate) return sendJson(res, gate.status, { error: gate.error });
        return void (await shareApi.createShare(req, res));
      }
      if (req.method === 'GET'  && pathname.startsWith('/api/share/')) {
        const token = pathname.slice('/api/share/'.length);
        return void (await shareApi.getShare(req, res, token));
      }

      
    // Serve uploaded images (admin-uploaded announcement images etc.)
    if (pathname.startsWith('/uploads/images/')) {
      const fname = path.basename(pathname);
      if (!/^img_[\w.-]+$/.test(fname)) return sendJson(res, 400, { error: 'bad_path' });
      const fpath = path.join(DATA_DIR, 'uploads', 'images', fname);
      if (!fs.existsSync(fpath)) return sendJson(res, 404, { error: 'not_found' });
      const ext = path.extname(fname).toLowerCase();
      const mime = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' }[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'public, max-age=86400' });
      fs.createReadStream(fpath).pipe(res);
      return;
    }
    return sendJson(res, 404, { error: 'not_found' });
    }

    // ---------- App (auth-gated) ----------
    if (pathname === '/app' || pathname === '/app/' || pathname.startsWith('/app/')) {
      const user = auth.currentUser(parseCookies(req));
      if (!user) {
        res.writeHead(302, { Location: '/login.html?next=' + encodeURIComponent(pathname) });
        return res.end();
      }
      const rel = pathname.replace(/^\/app/, '') || '/';
      if (serveStatic(res, APP_DIR, rel)) return;
      return sendText(res, 404, 'Not found');
    }

    // ---------- Public share links ----------
    // /share/<token> serves one static page; the page then fetches
    // /api/share/<token> for the payload. Keeps the token out of the HTML.
    if (pathname === '/share' || pathname.startsWith('/share/')) {
      if (serveStatic(res, PUBLIC_DIR, '/share.html')) return;
    }

    // ---------- Marketing / static public ----------
    if (pathname === '/') { if (serveStatic(res, PUBLIC_DIR, '/index.html')) return; }
    if (serveStatic(res, PUBLIC_DIR, pathname)) return;

    // SPA-ish fallback to 404 page if present.
    const notFound = path.join(PUBLIC_DIR, '404.html');
    if (fs.existsSync(notFound)) { res.writeHead(404); return fs.createReadStream(notFound).pipe(res); }
    return sendText(res, 404, 'Not found');
  } catch (err) {
    const status = err && err.statusCode ? err.statusCode : 500;
    if (status >= 500) {
      // [FIX M12] الخطأ بيتسجل مع نفس rid اللي العميل شايفه في X-Request-Id،
      // فأي شكوى تبقى قابلة للتتبع في ثواني.
      logLine({
        t: new Date().toISOString(),
        lvl: 'error',
        rid: requestId,
        method: req.method,
        path: pathname,
        status: status,
        err: (err && err.message) || String(err),
        stack: (err && err.stack) ? String(err.stack).split('\n').slice(0, 5).join(' | ') : null,
      });
      // Never leak internal error details to the client.
      return sendJson(res, status, { error: 'server_error', requestId: requestId });
    }
    return sendJson(res, status, { error: err && err.message ? err.message : 'error', requestId: requestId });
  }
});

// Backups run in this process because it is the only one that can see the
// database disk. Failure to start must never take the server down.
try { require('./lib/backup-scheduler').start(); }
catch (e) { console.error('[backup] scheduler did not start:', e.message); }

server.listen(PORT, () => {
  console.log('ElForma running on http://localhost:' + PORT);
});

module.exports = server;
