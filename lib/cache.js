'use strict';
// طبقة كاش في الذاكرة بحد أقصى للعناصر وعمر محدد
//
// ليه محتاجينه
// أتقل طلب في التطبيق هو خطة التغذية لأنه بيشغل محرك كامل جوّا vm
// والمستخدم ممكن يفتح ويقفل الشاشة عشر مرات في الدقيقة
// من غير كاش كل فتحة دي تشغيلة محرك كاملة وده اللي بيعمل التهنيج لما يبقى فيه عدد كبير
//
// ليه LRU ومش مجرد Map
// مع ألف مستخدم الـ Map العادي بيفضل يكبر لحد ما الرام تخلص
// الحد الأقصى معناه إن الذاكرة محسوبة مهما زاد عدد المستخدمين

const DEFAULT_MAX = 500;
const DEFAULT_TTL = 90 * 1000;

function createCache(options) {
  const opts = options || {};
  const max = Math.max(16, Number(opts.max) || DEFAULT_MAX);
  const ttl = Math.max(1000, Number(opts.ttl) || DEFAULT_TTL);
  const store = new Map();
  let hits = 0, misses = 0, evictions = 0;

  function get(key) {
    const entry = store.get(key);
    if (!entry) { misses++; return undefined; }
    if (Date.now() > entry.expires) {
      store.delete(key);
      misses++;
      return undefined;
    }
    // إعادة الإدخال بتخليه أحدث عنصر في ترتيب Map
    store.delete(key);
    store.set(key, entry);
    hits++;
    return entry.value;
  }

  function set(key, value, customTtl) {
    if (store.has(key)) store.delete(key);
    store.set(key, { value: value, expires: Date.now() + (Number(customTtl) || ttl) });
    while (store.size > max) {
      const oldest = store.keys().next().value;
      store.delete(oldest);
      evictions++;
    }
    return value;
  }

  function del(key) { return store.delete(key); }

  // مسح كل مفاتيح مستخدم واحد
  // بنناديها بعد أي كتابة تخص المستخدم ده عشان ميشوفش بيانات قديمة
  function invalidatePrefix(prefix) {
    let n = 0;
    for (const k of Array.from(store.keys())) {
      if (k.indexOf(prefix) === 0) { store.delete(k); n++; }
    }
    return n;
  }

  function clear() { store.clear(); }

  function stats() {
    const total = hits + misses;
    return {
      size: store.size,
      max: max,
      ttlMs: ttl,
      hits: hits,
      misses: misses,
      evictions: evictions,
      hitRate: total ? Math.round((hits / total) * 100) : 0
    };
  }

  return { get, set, del, invalidatePrefix, clear, stats };
}

// كاش خطة التغذية
// 90 ثانية كفاية تمام لأن الخطة مابتتغيرش خلال ثواني وأي تعديل حقيقي بيمسح الكاش فورًا
const nutritionCache = createCache({ max: 800, ttl: 90 * 1000 });

// كاش الوحدات والكتالوج
// ده محتوى ثابت للكل فممكن يقعد أطول بكتير
const catalogueCache = createCache({ max: 64, ttl: 10 * 60 * 1000 });

module.exports = { createCache, nutritionCache, catalogueCache };
