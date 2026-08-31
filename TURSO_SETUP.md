# ربط ElForma بقاعدة بيانات دائمة مجانية (Turso)

## ليه Turso؟
مشروع ElForma مبني أصلًا على SQLite. **Turso** هو SQLite سحابي:
- **مجاني** (خطة سخية).
- **دائم**: الحسابات ما بتضيعش لو الاستضافة عملت restart أو redeploy (حتى على serverless زي Vercel).
- **بيكبر مع نجاح التطبيق**.
- **أقل تعديل**: نفس كود SQLite شغّال زي ما هو.

## إزاي بيشتغل في الكود؟
- **من غير أي إعداد**: التطبيق بيستخدم SQLite محلي (تجربة فورية).
- **لو ظبطت متغيّرات Turso**: بيتحوّل تلقائيًا لـ Embedded Replica — نسخة محلية سريعة بتتزامن مع السحابة.

## خطوات الإعداد (5 دقايق)

### 1) اعمل حساب وقاعدة بيانات
1. ادخل على https://turso.tech وسجّل (مجانًا، بحساب GitHub مثلًا).
2. بالأداة (اختياري):
   ```bash
   curl -sSfL https://get.tur.so/install.sh | bash
   turso auth login
   turso db create elforma
   turso db show elforma --url          # TURSO_DATABASE_URL
   turso db tokens create elforma       # TURSO_AUTH_TOKEN
   ```
   أو من لوحة التحكم: Create Database → انسخ الـ URL وأنشئ Token.

### 2) ظبط متغيّرات البيئة على الاستضافة
```
TURSO_DATABASE_URL=libsql://elforma-<your>.turso.io
TURSO_AUTH_TOKEN=<the-token-you-created>
EF_SECRET=<نص-ثابت-طويل-عشوائي-32-حرف-على-الأقل>
```

> **مهم جدًا:** `EF_SECRET` لازم يكون **ثابت** ومتخزّن كمتغيّر بيئة.
> لو مظبطتوش، مفتاح الجلسة بيتولّد من جديد بعد كل restart، فالمستخدم
> يلاقي نفسه **مسجّل خروج** حتى لو الحسابات موجودة.

### 3) ثبّت الاعتماد وشغّل
```bash
npm install          # هيثبّت libsql (optionalDependency)
npm start
```
هتلاقي في اللوج: `[db] Using Turso (libsql embedded replica)`.
(لو مظبطتش المتغيّرات هيظهر: `Using local SQLite`.)

## أسئلة شائعة
- **الداتا القديمة؟** لو عايز ترفع `data/elforma.db` قديمة للسحابة، قوللي وأديك أوامر الـ import.
- **الأمان؟** التوكن سرّي — خليه في متغيّرات البيئة بس، متحطّهوش في الكود.

## تحقّق
التعديل اتعمل واتراجع (node --check + الاختبارات 25/0 في الوضع المحلي)،
والتشغيل الفعلي مع السحابة بنجرّبه سوا بعد ما تضيف المتغيّرات.
