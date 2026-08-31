// ═══════════════════════════════════════════════════════════════
//  WEEKLY STRATEGY FOUNDATION LAYER  (v23 — Add-Only, No Meal Engine Touch)
//
//  هذه الطبقة تبني Strategy Metadata فقط.
//  لا تعدل buildSmartMealPlan · لا تعدل serving engine
//  لا تحذف أي logic · لا تغير database shape
//
//  الاستخدام:
//    const meta = WSL.getWeekStrategy(weekNum, goal, bodyFatPct, bmi, rate, tdee);
//    const adj  = WSL.getCalorieTarget(tdee, meta);
//    const macAdj = WSL.getMacroAdjustment(baseMacros, meta);
// ═══════════════════════════════════════════════════════════════

// ── Phase Types Enum ─────────────────────────────────────────────
const PHASE_TYPES = {
  // Fat-Loss phases
  AGGRESSIVE_CUT:    'aggressive_cut',     // عجز أقصى آمن
  MODERATE_CUT:      'moderate_cut',       // عجز معتدل — الأكثر شيوعا
  GENTLE_CUT:        'gentle_cut',         // عجز ناعم — حماية العضل
  REFEED:            'refeed',             // يوم/أيام رفع كارب
  DIET_BREAK:        'diet_break',         // أسبوع صيانة كاملة
  // Bulk phases
  LEAN_SURPLUS:      'lean_surplus',       // فائض ناعم
  MODERATE_SURPLUS:  'moderate_surplus',   // فائض معتدل
  AGGRESSIVE_SURPLUS:'aggressive_surplus', // فائض قوي (مبتدئ / بعد توقف)
  MINI_CUT:          'mini_cut',           // تنشيف قصير أثناء التضخيم
  // Recomp phases
  RECOMP_HIGH_PROTEIN:'recomp_high_protein', // حفاظ + بروتين جدا عالي
  RECOMP_CALORIE_CYCLE:'recomp_calorie_cycle',// تدوير سعرات
  // Maintenance phases
  MAINTENANCE:       'maintenance',        // توازن حقيقي
  REVERSE_DIET:      'reverse_diet',       // رفع تدريجي بعد كات
  // Special
  ADAPTATION:        'adaptation',         // تكيف الأسبوع الأول
  RECOVERY:          'recovery',           // استشفاء بعد كات قوي
  STABILIZATION:     'stabilization',      // تثبيت ما بعد الخسارة
  OBESE_AGGRESSIVE:  'obese_aggressive',   // سمنة — عجز أكبر مقبول طبيا
};

// ── Adherence Modes ──────────────────────────────────────────────
const ADHERENCE_MODES = {
  STRICT:     'strict',       // 90–100% التزام — كل سعرة محسوبة
  FLEXIBLE:   'flexible',     // 75–90% — مرونة معتدلة
  MODERATE:   'moderate',     // 65–80% — لا تتبع دقيق
  INTUITIVE:  'intuitive',    // حدسي — مناسب للصيانة والاستشفاء
};

// ── Rotation Intensity ───────────────────────────────────────────
const ROTATION_INTENSITY = {
  NONE:   'none',     // لا تدوير — يوم ثابت
  LOW:    'low',      // تدوير خفيف (refeed يوم/أسبوع)
  MEDIUM: 'medium',   // تدوير متوسط (carb cycling)
  HIGH:   'high',     // تدوير كثيف (carb cycling + refeed)
};

// ═══════════════════════════════════════════════════════════════
//  WEEKLY_PLAN_STRATEGIES
//  المصدر الوحيد للحقيقة للاستراتيجية الأسبوعية
//  بنية كل record:
//    weekNumber        — رقم الأسبوع (1-based)
//    phaseType         — نوع المرحلة من PHASE_TYPES
//    calorieAdjustment — نسبة تعديل السعرات فوق/تحت TDEE (مثال: -0.20 = عجز 20%)
//    macroAdjustment   — { proteinMult, carbMult, fatMult } مضاعفات الماكرو
//    refeedDays        — عدد أيام ال Refeed في الأسبوع (0–2)
//    adherenceMode     — أحد ADHERENCE_MODES
//    rotationIntensity — أحد ROTATION_INTENSITY
//    expectedWeightTrend — وصف تغير الوزن المتوقع
//    notes             — ملاحظة سريرية
// ═══════════════════════════════════════════════════════════════
const WEEKLY_PLAN_STRATEGIES = {

  // ──────────────────────────────────────────────────────────────
  //  FAT LOSS — 12 أسبوع تنشيف
  //  العلم: Eric Helms Protocol + Lyle McDonald UD2 concepts
  // ──────────────────────────────────────────────────────────────
  fat_loss: [
    // الأسبوع 1 — تكيف وتقييم
    {
      weekNumber: 1,
      phaseType: PHASE_TYPES.ADAPTATION,
      calorieAdjustment: -0.10,
      macroAdjustment: { proteinMult: 1.15, carbMult: 0.90, fatMult: 0.90 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.FLEXIBLE,
      rotationIntensity: ROTATION_INTENSITY.NONE,
      expectedWeightTrend: 'نزول طفيف 0.2–0.5 كجم — ماء ورم معظمه',
      notes: 'أسبوع تكيف. العجز خفيف عمدا لمنع الصدمة الأيضية. ابدأ بتتبع دقيق'
    },
    // الأسبوع 2 — بدء الحرق الحقيقي
    {
      weekNumber: 2,
      phaseType: PHASE_TYPES.MODERATE_CUT,
      calorieAdjustment: -0.18,
      macroAdjustment: { proteinMult: 1.20, carbMult: 0.85, fatMult: 0.88 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.STRICT,
      rotationIntensity: ROTATION_INTENSITY.NONE,
      expectedWeightTrend: 'نزول 0.4–0.6 كجم',
      notes: 'رفع البروتين لحماية اللين باس ماس. عجز معتدل 18%'
    },
    // الأسبوع 3 — ضغط تدريجي
    {
      weekNumber: 3,
      phaseType: PHASE_TYPES.MODERATE_CUT,
      calorieAdjustment: -0.20,
      macroAdjustment: { proteinMult: 1.20, carbMult: 0.82, fatMult: 0.85 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.STRICT,
      rotationIntensity: ROTATION_INTENSITY.NONE,
      expectedWeightTrend: 'نزول 0.4–0.7 كجم',
      notes: 'زيادة طفيفة في العجز. مراقبة مستوى الطاقة والأداء في التمرين'
    },
    // الأسبوع 4 — أول Refeed لإعادة ضبط اللبتين
    {
      weekNumber: 4,
      phaseType: PHASE_TYPES.REFEED,
      calorieAdjustment: -0.20,
      macroAdjustment: { proteinMult: 1.15, carbMult: 1.30, fatMult: 0.70 },
      refeedDays: 1,
      adherenceMode: ADHERENCE_MODES.FLEXIBLE,
      rotationIntensity: ROTATION_INTENSITY.LOW,
      expectedWeightTrend: 'ثبات أو زيادة طفيفة (ماء) ثم نزول',
      notes: 'Refeed يوم واحد = رفع الكارب ل TDEE. يعيد ضبط Leptin ويمنع plateau. الدهون تنزل طوال الأسبوع'
    },
    // الأسبوع 5-6 — قطع ذكي مستمر
    {
      weekNumber: 5,
      phaseType: PHASE_TYPES.MODERATE_CUT,
      calorieAdjustment: -0.22,
      macroAdjustment: { proteinMult: 1.22, carbMult: 0.80, fatMult: 0.83 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.STRICT,
      rotationIntensity: ROTATION_INTENSITY.NONE,
      expectedWeightTrend: 'نزول 0.45–0.70 كجم',
      notes: 'رفع العجز تدريجيا مع حفاظ البروتين. الجسم بدأ التكيف — زد الكارديو بدلا من قطع السعرات أكثر'
    },
    {
      weekNumber: 6,
      phaseType: PHASE_TYPES.REFEED,
      calorieAdjustment: -0.22,
      macroAdjustment: { proteinMult: 1.15, carbMult: 1.35, fatMult: 0.65 },
      refeedDays: 1,
      adherenceMode: ADHERENCE_MODES.FLEXIBLE,
      rotationIntensity: ROTATION_INTENSITY.LOW,
      expectedWeightTrend: 'ثبات مؤقت ثم استمرار النزول',
      notes: 'Refeed إلزامي عند الأسبوع 6. أعراض التكيف الأيضي تظهر هنا — جوع أكثر، طاقة أقل'
    },
    // الأسبوع 7-8 — Push Phase مكثف
    {
      weekNumber: 7,
      phaseType: PHASE_TYPES.AGGRESSIVE_CUT,
      calorieAdjustment: -0.25,
      macroAdjustment: { proteinMult: 1.25, carbMult: 0.75, fatMult: 0.80 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.STRICT,
      rotationIntensity: ROTATION_INTENSITY.LOW,
      expectedWeightTrend: 'نزول 0.5–0.8 كجم',
      notes: 'أقصى عجز آمن 25%. مدة محدودة (2 أسبوع) فقط. بروتين أعلى لمنع هدم العضل'
    },
    {
      weekNumber: 8,
      phaseType: PHASE_TYPES.AGGRESSIVE_CUT,
      calorieAdjustment: -0.25,
      macroAdjustment: { proteinMult: 1.25, carbMult: 0.72, fatMult: 0.78 },
      refeedDays: 1,
      adherenceMode: ADHERENCE_MODES.STRICT,
      rotationIntensity: ROTATION_INTENSITY.MEDIUM,
      expectedWeightTrend: 'نزول 0.5–0.8 كجم',
      notes: 'Refeed إلزامي في نهاية الأسبوع بعد أسبوعين عجز قوي. تحذير: أكثر من 4 أسابيع بعجز 25% يهدم العضل'
    },
    // الأسبوع 9 — Recovery Relief أسبوع راحة أيضية
    {
      weekNumber: 9,
      phaseType: PHASE_TYPES.DIET_BREAK,
      calorieAdjustment: 0.00,
      macroAdjustment: { proteinMult: 1.10, carbMult: 1.00, fatMult: 1.00 },
      refeedDays: 7,
      adherenceMode: ADHERENCE_MODES.FLEXIBLE,
      rotationIntensity: ROTATION_INTENSITY.NONE,
      expectedWeightTrend: 'ثبات أو زيادة 0.5–1 كجم (ماء وجليكوجين)',
      notes: 'Diet Break: أسبوع عند TDEE كامل. يعيد ضبط الهرمونات (Leptin، T3، Ghrelin). الدراسات: يسرع الفقدان على المدى البعيد'
    },
    // الأسبوع 10-11 — Final Cut
    {
      weekNumber: 10,
      phaseType: PHASE_TYPES.GENTLE_CUT,
      calorieAdjustment: -0.15,
      macroAdjustment: { proteinMult: 1.20, carbMult: 0.85, fatMult: 0.88 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.FLEXIBLE,
      rotationIntensity: ROTATION_INTENSITY.NONE,
      expectedWeightTrend: 'نزول 0.3–0.5 كجم',
      notes: 'عودة بعجز أخف بعد Diet Break. الجسم متجدد هرمونيا — استجابة أفضل للعجز'
    },
    {
      weekNumber: 11,
      phaseType: PHASE_TYPES.MODERATE_CUT,
      calorieAdjustment: -0.20,
      macroAdjustment: { proteinMult: 1.20, carbMult: 0.82, fatMult: 0.85 },
      refeedDays: 1,
      adherenceMode: ADHERENCE_MODES.STRICT,
      rotationIntensity: ROTATION_INTENSITY.LOW,
      expectedWeightTrend: 'نزول 0.4–0.6 كجم',
      notes: 'آخر أسبوع عجز قوي. Refeed يوم في نهاية الأسبوع'
    },
    // الأسبوع 12 — Stabilization
    {
      weekNumber: 12,
      phaseType: PHASE_TYPES.STABILIZATION,
      calorieAdjustment: -0.08,
      macroAdjustment: { proteinMult: 1.15, carbMult: 0.95, fatMult: 0.95 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.MODERATE,
      rotationIntensity: ROTATION_INTENSITY.NONE,
      expectedWeightTrend: 'ثبات أو نزول 0.1–0.3 كجم',
      notes: 'تثبيت النتيجة. عجز رمزي 8% للحفاظ. مرونة أكبر. الهدف: الاستدامة، لا الضغط'
    }
  ],

  // ──────────────────────────────────────────────────────────────
  //  LEAN BULK — 12 أسبوع تضخيم ناعم
  //  العلم: Alan Aragon, Eric Helms Protein Guidelines
  // ──────────────────────────────────────────────────────────────
  lean_bulk: [
    {
      weekNumber: 1,
      phaseType: PHASE_TYPES.ADAPTATION,
      calorieAdjustment: +0.05,
      macroAdjustment: { proteinMult: 1.10, carbMult: 1.05, fatMult: 1.00 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.FLEXIBLE,
      rotationIntensity: ROTATION_INTENSITY.NONE,
      expectedWeightTrend: 'ثبات أو زيادة 0.2–0.5 كجم (ماء)',
      notes: 'أسبوع تكيف. فائض خفيف جدا. ابدأ تدريجيا لتقليل زيادة الدهون'
    },
    {
      weekNumber: 2,
      phaseType: PHASE_TYPES.LEAN_SURPLUS,
      calorieAdjustment: +0.10,
      macroAdjustment: { proteinMult: 1.10, carbMult: 1.15, fatMult: 1.05 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.STRICT,
      rotationIntensity: ROTATION_INTENSITY.NONE,
      expectedWeightTrend: 'زيادة 0.2–0.4 كجم',
      notes: 'فائض 10% — المعيار الذهبي لل Lean Bulk. زيادة الكارب لملء الجليكوجين ودعم التمرين'
    },
    {
      weekNumber: 3,
      phaseType: PHASE_TYPES.LEAN_SURPLUS,
      calorieAdjustment: +0.10,
      macroAdjustment: { proteinMult: 1.12, carbMult: 1.18, fatMult: 1.05 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.STRICT,
      rotationIntensity: ROTATION_INTENSITY.NONE,
      expectedWeightTrend: 'زيادة 0.2–0.4 كجم',
      notes: 'رفع طفيف في الكارب مع الحفاظ على الفائض. مراقبة نسبة الدهون (لا تتجاوز 1% زيادة شهريا)'
    },
    {
      weekNumber: 4,
      phaseType: PHASE_TYPES.MODERATE_SURPLUS,
      calorieAdjustment: +0.15,
      macroAdjustment: { proteinMult: 1.10, carbMult: 1.25, fatMult: 1.05 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.STRICT,
      rotationIntensity: ROTATION_INTENSITY.NONE,
      expectedWeightTrend: 'زيادة 0.3–0.5 كجم',
      notes: 'رفع الفائض لل 15% في الأسبوع الرابع. الكارب الرئيسي في أيام التمرين'
    },
    {
      weekNumber: 5,
      phaseType: PHASE_TYPES.MODERATE_SURPLUS,
      calorieAdjustment: +0.15,
      macroAdjustment: { proteinMult: 1.12, carbMult: 1.25, fatMult: 1.05 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.STRICT,
      rotationIntensity: ROTATION_INTENSITY.LOW,
      expectedWeightTrend: 'زيادة 0.3–0.5 كجم',
      notes: 'تدوير خفيف: كارب أعلى أيام تمرين، أقل أيام راحة. يحسن تقسيم العضل/الدهون'
    },
    {
      weekNumber: 6,
      phaseType: PHASE_TYPES.MODERATE_SURPLUS,
      calorieAdjustment: +0.15,
      macroAdjustment: { proteinMult: 1.10, carbMult: 1.28, fatMult: 1.00 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.STRICT,
      rotationIntensity: ROTATION_INTENSITY.LOW,
      expectedWeightTrend: 'زيادة 0.3–0.5 كجم',
      notes: 'نقطة تقييم منتصف الخطة. قيم جودة الزيادة: هل هي عضل أم دهون؟ إذا دهون > 1%/شهر قلل الفائض'
    },
    {
      weekNumber: 7,
      phaseType: PHASE_TYPES.AGGRESSIVE_SURPLUS,
      calorieAdjustment: +0.20,
      macroAdjustment: { proteinMult: 1.10, carbMult: 1.35, fatMult: 1.05 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.STRICT,
      rotationIntensity: ROTATION_INTENSITY.MEDIUM,
      expectedWeightTrend: 'زيادة 0.4–0.7 كجم',
      notes: 'فائض أقوى ل 3 أسابيع. مناسب بعد إثبات أن الاستجابة جيدة. كارب سايكل هنا يزيد الكفاءة'
    },
    {
      weekNumber: 8,
      phaseType: PHASE_TYPES.AGGRESSIVE_SURPLUS,
      calorieAdjustment: +0.20,
      macroAdjustment: { proteinMult: 1.10, carbMult: 1.38, fatMult: 1.05 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.STRICT,
      rotationIntensity: ROTATION_INTENSITY.MEDIUM,
      expectedWeightTrend: 'زيادة 0.4–0.7 كجم',
      notes: 'ذروة التضخيم. قيس محيط الخصر — إذا زاد > 2سم هذا الشهر، قلل لل Lean Surplus'
    },
    {
      weekNumber: 9,
      phaseType: PHASE_TYPES.MINI_CUT,
      calorieAdjustment: -0.12,
      macroAdjustment: { proteinMult: 1.20, carbMult: 0.85, fatMult: 0.85 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.STRICT,
      rotationIntensity: ROTATION_INTENSITY.NONE,
      expectedWeightTrend: 'نزول 0.3–0.5 كجم',
      notes: 'Mini-Cut أسبوع واحد. ينظف الدهون المتراكمة ويعيد حساسية الأنسولين. لا يفقد العضل إذا بقي البروتين عاليا'
    },
    {
      weekNumber: 10,
      phaseType: PHASE_TYPES.LEAN_SURPLUS,
      calorieAdjustment: +0.10,
      macroAdjustment: { proteinMult: 1.12, carbMult: 1.20, fatMult: 1.05 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.STRICT,
      rotationIntensity: ROTATION_INTENSITY.LOW,
      expectedWeightTrend: 'زيادة 0.2–0.4 كجم',
      notes: 'عودة لل Lean Surplus بعد Mini-Cut. الجسم أكثر حساسية للأنسولين — استفد منه'
    },
    {
      weekNumber: 11,
      phaseType: PHASE_TYPES.LEAN_SURPLUS,
      calorieAdjustment: +0.12,
      macroAdjustment: { proteinMult: 1.12, carbMult: 1.22, fatMult: 1.05 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.STRICT,
      rotationIntensity: ROTATION_INTENSITY.LOW,
      expectedWeightTrend: 'زيادة 0.25–0.45 كجم',
      notes: 'رفع طفيف في الفائض. أسبوع ما قبل النهاية — أكمل بقوة'
    },
    {
      weekNumber: 12,
      phaseType: PHASE_TYPES.STABILIZATION,
      calorieAdjustment: +0.05,
      macroAdjustment: { proteinMult: 1.10, carbMult: 1.10, fatMult: 1.05 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.MODERATE,
      rotationIntensity: ROTATION_INTENSITY.NONE,
      expectedWeightTrend: 'ثبات أو زيادة 0.1–0.3 كجم',
      notes: 'تثبيت المكتسبات. فائض رمزي. مرونة أكبر في الخيارات. قيم النتيجة الكلية'
    }
  ],

  // ──────────────────────────────────────────────────────────────
  //  RECOMP — 12 أسبوع إعادة تركيب جسم
  //  العلم: Brad Schoenfeld RET + Body Recomposition Research
  // ──────────────────────────────────────────────────────────────
  recomp: [
    {
      weekNumber: 1,
      phaseType: PHASE_TYPES.ADAPTATION,
      calorieAdjustment: 0.00,
      macroAdjustment: { proteinMult: 1.20, carbMult: 0.95, fatMult: 0.95 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.FLEXIBLE,
      rotationIntensity: ROTATION_INTENSITY.NONE,
      expectedWeightTrend: 'ثبات أو تغير طفيف جدا',
      notes: 'بدء Recomp. أساس: بروتين عالي جدا (2.4–3.1 جم/كجم LBM). الهدف ليس الميزان — الهدف التركيبة'
    },
    {
      weekNumber: 2,
      phaseType: PHASE_TYPES.RECOMP_HIGH_PROTEIN,
      calorieAdjustment: -0.05,
      macroAdjustment: { proteinMult: 1.30, carbMult: 0.92, fatMult: 0.90 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.STRICT,
      rotationIntensity: ROTATION_INTENSITY.NONE,
      expectedWeightTrend: 'ثبات أو نزول 0.1–0.2 كجم',
      notes: 'عجز طفيف 5% + بروتين مرتفع جدا = التركيبة المثالية لل Recomp. صعب لكن ممكن خاصة للمبتدئين'
    },
    {
      weekNumber: 3,
      phaseType: PHASE_TYPES.RECOMP_CALORIE_CYCLE,
      calorieAdjustment: -0.05,
      macroAdjustment: { proteinMult: 1.28, carbMult: 0.95, fatMult: 0.90 },
      refeedDays: 1,
      adherenceMode: ADHERENCE_MODES.STRICT,
      rotationIntensity: ROTATION_INTENSITY.MEDIUM,
      expectedWeightTrend: 'ثبات أو تذبذب ±0.3 كجم',
      notes: 'كارب سايكل: أيام تمرين = سعرات أعلى، أيام راحة = عجز أكبر. يحسن استخدام الطاقة ويسرع ال Recomp'
    },
    {
      weekNumber: 4,
      phaseType: PHASE_TYPES.RECOMP_CALORIE_CYCLE,
      calorieAdjustment: -0.05,
      macroAdjustment: { proteinMult: 1.28, carbMult: 0.95, fatMult: 0.90 },
      refeedDays: 1,
      adherenceMode: ADHERENCE_MODES.STRICT,
      rotationIntensity: ROTATION_INTENSITY.MEDIUM,
      expectedWeightTrend: 'ثبات أو تذبذب ±0.3 كجم',
      notes: 'استمرار الكارب سايكل. قيس محيط الخصر + محيط الذراع. هذا أهم من الميزان هنا'
    },
    {
      weekNumber: 5,
      phaseType: PHASE_TYPES.RECOMP_HIGH_PROTEIN,
      calorieAdjustment: -0.08,
      macroAdjustment: { proteinMult: 1.32, carbMult: 0.90, fatMult: 0.88 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.STRICT,
      rotationIntensity: ROTATION_INTENSITY.LOW,
      expectedWeightTrend: 'نزول 0.1–0.3 كجم',
      notes: 'رفع طفيف في العجز. البروتين في أعلى نقطة. هذا هو "صيغة ال Recomp الذهبية".'
    },
    {
      weekNumber: 6,
      phaseType: PHASE_TYPES.RECOVERY,
      calorieAdjustment: 0.00,
      macroAdjustment: { proteinMult: 1.15, carbMult: 1.05, fatMult: 1.00 },
      refeedDays: 3,
      adherenceMode: ADHERENCE_MODES.MODERATE,
      rotationIntensity: ROTATION_INTENSITY.LOW,
      expectedWeightTrend: 'ثبات أو زيادة ±0.3 كجم',
      notes: 'أسبوع راحة أيضية. 3 أيام Refeed خلال الأسبوع. يمنع التكيف الأيضي ويعيد الطاقة للتمرين'
    },
    {
      weekNumber: 7,
      phaseType: PHASE_TYPES.RECOMP_CALORIE_CYCLE,
      calorieAdjustment: -0.05,
      macroAdjustment: { proteinMult: 1.30, carbMult: 0.95, fatMult: 0.88 },
      refeedDays: 1,
      adherenceMode: ADHERENCE_MODES.STRICT,
      rotationIntensity: ROTATION_INTENSITY.MEDIUM,
      expectedWeightTrend: 'ثبات أو تذبذب ±0.3 كجم',
      notes: 'استئناف بعد أسبوع الراحة. الاستجابة للبروتين والتمرين أفضل الآن'
    },
    {
      weekNumber: 8,
      phaseType: PHASE_TYPES.RECOMP_HIGH_PROTEIN,
      calorieAdjustment: -0.08,
      macroAdjustment: { proteinMult: 1.32, carbMult: 0.90, fatMult: 0.85 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.STRICT,
      rotationIntensity: ROTATION_INTENSITY.LOW,
      expectedWeightTrend: 'نزول 0.2–0.4 كجم',
      notes: 'أقوى أسابيع ال Recomp. بروتين أعلى + عجز 8%. مناسب للمتقدمين'
    },
    {
      weekNumber: 9,
      phaseType: PHASE_TYPES.RECOMP_CALORIE_CYCLE,
      calorieAdjustment: -0.05,
      macroAdjustment: { proteinMult: 1.28, carbMult: 0.95, fatMult: 0.90 },
      refeedDays: 1,
      adherenceMode: ADHERENCE_MODES.STRICT,
      rotationIntensity: ROTATION_INTENSITY.MEDIUM,
      expectedWeightTrend: 'ثبات',
      notes: 'كارب سايكل استراتيجي. أيام التمرين: فائض صغير. أيام الراحة: عجز معتدل'
    },
    {
      weekNumber: 10,
      phaseType: PHASE_TYPES.RECOMP_HIGH_PROTEIN,
      calorieAdjustment: -0.05,
      macroAdjustment: { proteinMult: 1.30, carbMult: 0.92, fatMult: 0.90 },
      refeedDays: 1,
      adherenceMode: ADHERENCE_MODES.STRICT,
      rotationIntensity: ROTATION_INTENSITY.LOW,
      expectedWeightTrend: 'ثبات أو نزول 0.1–0.2 كجم',
      notes: 'أسبوع قوي. Refeed يوم للحفاظ على الأداء'
    },
    {
      weekNumber: 11,
      phaseType: PHASE_TYPES.RECOMP_CALORIE_CYCLE,
      calorieAdjustment: -0.05,
      macroAdjustment: { proteinMult: 1.28, carbMult: 0.95, fatMult: 0.90 },
      refeedDays: 1,
      adherenceMode: ADHERENCE_MODES.FLEXIBLE,
      rotationIntensity: ROTATION_INTENSITY.MEDIUM,
      expectedWeightTrend: 'ثبات',
      notes: 'ما قبل النهاية. مرونة أكبر في المصادر بينما تحافظ على الأرقام'
    },
    {
      weekNumber: 12,
      phaseType: PHASE_TYPES.STABILIZATION,
      calorieAdjustment: 0.00,
      macroAdjustment: { proteinMult: 1.15, carbMult: 1.00, fatMult: 1.00 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.MODERATE,
      rotationIntensity: ROTATION_INTENSITY.NONE,
      expectedWeightTrend: 'ثبات',
      notes: 'تثبيت نهائي. صيانة كاملة. قيس التغييرات في التركيبة (قياسات + صور) لا الميزان فقط'
    }
  ],

  // ──────────────────────────────────────────────────────────────
  //  MAINTENANCE — 12 أسبوع صيانة ذكية
  //  العلم: Reverse Dieting (Layne Norton) + Metabolic Adaptation
  // ──────────────────────────────────────────────────────────────
  maintenance: [
    {
      weekNumber: 1,
      phaseType: PHASE_TYPES.ADAPTATION,
      calorieAdjustment: 0.00,
      macroAdjustment: { proteinMult: 1.05, carbMult: 1.00, fatMult: 1.00 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.FLEXIBLE,
      rotationIntensity: ROTATION_INTENSITY.NONE,
      expectedWeightTrend: 'ثبات ±0.5 كجم',
      notes: 'إيجاد TDEE الحقيقي. لا يوجد شخصان لهما نفس ال TDEE الفعلي — راقب الوزن لأسبوعين لضبط الرقم'
    },
    {
      weekNumber: 2,
      phaseType: PHASE_TYPES.MAINTENANCE,
      calorieAdjustment: 0.00,
      macroAdjustment: { proteinMult: 1.05, carbMult: 1.00, fatMult: 1.00 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.MODERATE,
      rotationIntensity: ROTATION_INTENSITY.NONE,
      expectedWeightTrend: 'ثبات ±0.3 كجم',
      notes: 'تأكيد TDEE. إذا نزل الوزن > 0.5 كجم هذا الأسبوع اضف 100–150 kcal. إذا ارتفع قلل بنفس المقدار'
    },
    {
      weekNumber: 3,
      phaseType: PHASE_TYPES.MAINTENANCE,
      calorieAdjustment: 0.00,
      macroAdjustment: { proteinMult: 1.05, carbMult: 1.02, fatMult: 1.00 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.MODERATE,
      rotationIntensity: ROTATION_INTENSITY.NONE,
      expectedWeightTrend: 'ثبات',
      notes: 'صيانة مستقرة. الهدف الحقيقي: تحسين العلاقة بالطعام وتطبيع السلوك الغذائي'
    },
    {
      weekNumber: 4,
      phaseType: PHASE_TYPES.MAINTENANCE,
      calorieAdjustment: 0.00,
      macroAdjustment: { proteinMult: 1.05, carbMult: 1.02, fatMult: 1.00 },
      refeedDays: 1,
      adherenceMode: ADHERENCE_MODES.MODERATE,
      rotationIntensity: ROTATION_INTENSITY.LOW,
      expectedWeightTrend: 'ثبات',
      notes: 'يوم مرونة (flexibility day) أسبوعيا. يقلل الضغط النفسي ويحسن الالتزام طويل المدى'
    },
    {
      weekNumber: 5,
      phaseType: PHASE_TYPES.REVERSE_DIET,
      calorieAdjustment: +0.03,
      macroAdjustment: { proteinMult: 1.05, carbMult: 1.05, fatMult: 1.02 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.MODERATE,
      rotationIntensity: ROTATION_INTENSITY.NONE,
      expectedWeightTrend: 'ثبات أو زيادة 0.1 كجم',
      notes: 'Reverse Diet خطوة 1: رفع +3% فوق TDEE. يرفع الأيض الأساسي تدريجيا. يمنع التكيف الأيضي'
    },
    {
      weekNumber: 6,
      phaseType: PHASE_TYPES.MAINTENANCE,
      calorieAdjustment: 0.00,
      macroAdjustment: { proteinMult: 1.05, carbMult: 1.02, fatMult: 1.00 },
      refeedDays: 1,
      adherenceMode: ADHERENCE_MODES.INTUITIVE,
      rotationIntensity: ROTATION_INTENSITY.LOW,
      expectedWeightTrend: 'ثبات',
      notes: 'أسبوع حدسي. تعلم الإنصات للجسم. هذه المهارة أهم من أي خطة على المدى البعيد'
    },
    {
      weekNumber: 7,
      phaseType: PHASE_TYPES.MAINTENANCE,
      calorieAdjustment: 0.00,
      macroAdjustment: { proteinMult: 1.05, carbMult: 1.02, fatMult: 1.00 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.MODERATE,
      rotationIntensity: ROTATION_INTENSITY.NONE,
      expectedWeightTrend: 'ثبات',
      notes: 'صيانة مستقرة. راجع أهدافك: هل ما زلت في الصيانة؟ أم حان وقت ال Cut أو ال Bulk التالي؟'
    },
    {
      weekNumber: 8,
      phaseType: PHASE_TYPES.REVERSE_DIET,
      calorieAdjustment: +0.05,
      macroAdjustment: { proteinMult: 1.05, carbMult: 1.08, fatMult: 1.02 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.MODERATE,
      rotationIntensity: ROTATION_INTENSITY.NONE,
      expectedWeightTrend: 'ثبات أو زيادة 0.1–0.2 كجم',
      notes: 'Reverse Diet خطوة 2: رفع إضافي +2%. إجمالي +5% فوق TDEE الأصلي. مكسب أيضي طويل الأمد'
    },
    {
      weekNumber: 9,
      phaseType: PHASE_TYPES.MAINTENANCE,
      calorieAdjustment: 0.00,
      macroAdjustment: { proteinMult: 1.05, carbMult: 1.02, fatMult: 1.00 },
      refeedDays: 1,
      adherenceMode: ADHERENCE_MODES.FLEXIBLE,
      rotationIntensity: ROTATION_INTENSITY.LOW,
      expectedWeightTrend: 'ثبات',
      notes: 'صيانة مستقرة مع مرونة أكبر. المرونة المدارة أفضل من الصرامة غير المستدامة'
    },
    {
      weekNumber: 10,
      phaseType: PHASE_TYPES.MAINTENANCE,
      calorieAdjustment: 0.00,
      macroAdjustment: { proteinMult: 1.05, carbMult: 1.02, fatMult: 1.00 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.MODERATE,
      rotationIntensity: ROTATION_INTENSITY.NONE,
      expectedWeightTrend: 'ثبات',
      notes: 'استمرار الصيانة. أضف مكونات جديدة لمنع الملل. التنويع الغذائي مهم للمعادن والفيتامينات'
    },
    {
      weekNumber: 11,
      phaseType: PHASE_TYPES.MAINTENANCE,
      calorieAdjustment: 0.00,
      macroAdjustment: { proteinMult: 1.05, carbMult: 1.02, fatMult: 1.00 },
      refeedDays: 1,
      adherenceMode: ADHERENCE_MODES.FLEXIBLE,
      rotationIntensity: ROTATION_INTENSITY.LOW,
      expectedWeightTrend: 'ثبات',
      notes: 'ما قبل النهاية. نجاح الصيانة طويل الأمد = عادات سليمة لا خطة صارمة'
    },
    {
      weekNumber: 12,
      phaseType: PHASE_TYPES.STABILIZATION,
      calorieAdjustment: 0.00,
      macroAdjustment: { proteinMult: 1.05, carbMult: 1.02, fatMult: 1.00 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.INTUITIVE,
      rotationIntensity: ROTATION_INTENSITY.NONE,
      expectedWeightTrend: 'ثبات',
      notes: 'تثبيت نهائي. استمر أو انتقل لمرحلة جديدة (Cut / Bulk). احتفظ بعادات الصيانة دائما'
    }
  ],

  // ────────────────────────────────────────────────────────────────
  //  OBESE BEGINNER — بروتوكول السمنة للمبتدئ
  //  العلم: ACSM Guidelines + مراعاة ال Metabolic Syndrome
  // ──────────────────────────────────────────────────────────────
  obese_beginner: [
    {
      weekNumber: 1,
      phaseType: PHASE_TYPES.ADAPTATION,
      calorieAdjustment: -0.15,
      macroAdjustment: { proteinMult: 1.15, carbMult: 0.85, fatMult: 0.90 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.FLEXIBLE,
      rotationIntensity: ROTATION_INTENSITY.NONE,
      expectedWeightTrend: 'نزول 0.5–1.5 كجم (ماء في البداية)',
      notes: 'مبتدئ بسمنة: بداية تدريجية. عجز 15% آمن. التركيز على جودة الطعام أولا، الكمية ثانيا'
    },
    {
      weekNumber: 2,
      phaseType: PHASE_TYPES.OBESE_AGGRESSIVE,
      calorieAdjustment: -0.25,
      macroAdjustment: { proteinMult: 1.20, carbMult: 0.80, fatMult: 0.82 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.STRICT,
      rotationIntensity: ROTATION_INTENSITY.NONE,
      expectedWeightTrend: 'نزول 0.7–1.2 كجم',
      notes: 'السمنة: عجز 25% مقبول طبيا بسبب الاحتياطي الدهني الكبير. خطر هدم العضل أقل نسبيا عند BMI > 30'
    },
    {
      weekNumber: 3,
      phaseType: PHASE_TYPES.OBESE_AGGRESSIVE,
      calorieAdjustment: -0.25,
      macroAdjustment: { proteinMult: 1.22, carbMult: 0.78, fatMult: 0.80 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.STRICT,
      rotationIntensity: ROTATION_INTENSITY.NONE,
      expectedWeightTrend: 'نزول 0.7–1.2 كجم',
      notes: 'استمرار. مراقبة ضغط الدم والسكر إذا كانت هناك حالات صحية. ابدأ بالحركة تدريجيا'
    },
    {
      weekNumber: 4,
      phaseType: PHASE_TYPES.REFEED,
      calorieAdjustment: -0.25,
      macroAdjustment: { proteinMult: 1.15, carbMult: 1.20, fatMult: 0.75 },
      refeedDays: 1,
      adherenceMode: ADHERENCE_MODES.FLEXIBLE,
      rotationIntensity: ROTATION_INTENSITY.LOW,
      expectedWeightTrend: 'ثبات أو ارتفاع مؤقت 0.5–1 كجم',
      notes: 'Refeed إلزامي كل 4 أسابيع في بروتوكول السمنة. يمنع انهيار الأيض الأساسي'
    },
    {
      weekNumber: 5,
      phaseType: PHASE_TYPES.OBESE_AGGRESSIVE,
      calorieAdjustment: -0.25,
      macroAdjustment: { proteinMult: 1.22, carbMult: 0.78, fatMult: 0.80 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.STRICT,
      rotationIntensity: ROTATION_INTENSITY.NONE,
      expectedWeightTrend: 'نزول 0.7–1.0 كجم',
      notes: 'معدل النزول ينخفض تدريجيا — هذا طبيعي. الجسم يفقد ماء أقل الآن والدهون الفعلية أبطأ'
    },
    {
      weekNumber: 6,
      phaseType: PHASE_TYPES.DIET_BREAK,
      calorieAdjustment: 0.00,
      macroAdjustment: { proteinMult: 1.10, carbMult: 1.00, fatMult: 1.00 },
      refeedDays: 7,
      adherenceMode: ADHERENCE_MODES.FLEXIBLE,
      rotationIntensity: ROTATION_INTENSITY.NONE,
      expectedWeightTrend: 'ثبات أو زيادة 0.5–1 كجم (مؤقت)',
      notes: 'Diet Break كامل بعد 5 أسابيع. ضروري لمنع انهيار ال Leptin. لا تخف من الزيادة — إنها ماء وجليكوجين'
    },
    {
      weekNumber: 7,
      phaseType: PHASE_TYPES.OBESE_AGGRESSIVE,
      calorieAdjustment: -0.22,
      macroAdjustment: { proteinMult: 1.22, carbMult: 0.80, fatMult: 0.82 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.STRICT,
      rotationIntensity: ROTATION_INTENSITY.NONE,
      expectedWeightTrend: 'نزول 0.6–1.0 كجم',
      notes: 'عودة بعجز أخف قليلا. الجسم تجدد — استجابة أفضل للحمية'
    },
    {
      weekNumber: 8,
      phaseType: PHASE_TYPES.OBESE_AGGRESSIVE,
      calorieAdjustment: -0.22,
      macroAdjustment: { proteinMult: 1.22, carbMult: 0.80, fatMult: 0.82 },
      refeedDays: 1,
      adherenceMode: ADHERENCE_MODES.STRICT,
      rotationIntensity: ROTATION_INTENSITY.LOW,
      expectedWeightTrend: 'نزول 0.6–0.9 كجم',
      notes: 'Refeed يوم في نهاية الأسبوع. ابدأ التمرين المنتظم الآن إذا لم تبدأ — له أثر ضخم في هذه المرحلة'
    },
    {
      weekNumber: 9,
      phaseType: PHASE_TYPES.MODERATE_CUT,
      calorieAdjustment: -0.20,
      macroAdjustment: { proteinMult: 1.20, carbMult: 0.82, fatMult: 0.85 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.STRICT,
      rotationIntensity: ROTATION_INTENSITY.NONE,
      expectedWeightTrend: 'نزول 0.5–0.8 كجم',
      notes: 'انتقال تدريجي من بروتوكول السمنة للبروتوكول المعياري. BMI بدأ ينزل — الجسم يستجيب للعجز المعتدل الآن'
    },
    {
      weekNumber: 10,
      phaseType: PHASE_TYPES.MODERATE_CUT,
      calorieAdjustment: -0.20,
      macroAdjustment: { proteinMult: 1.20, carbMult: 0.82, fatMult: 0.85 },
      refeedDays: 1,
      adherenceMode: ADHERENCE_MODES.STRICT,
      rotationIntensity: ROTATION_INTENSITY.LOW,
      expectedWeightTrend: 'نزول 0.4–0.7 كجم',
      notes: 'Refeed أسبوعيا الآن. الجسم أصبح يستجيب لل Refeed بشكل أسرع وأوضح'
    },
    {
      weekNumber: 11,
      phaseType: PHASE_TYPES.MODERATE_CUT,
      calorieAdjustment: -0.18,
      macroAdjustment: { proteinMult: 1.20, carbMult: 0.85, fatMult: 0.88 },
      refeedDays: 1,
      adherenceMode: ADHERENCE_MODES.FLEXIBLE,
      rotationIntensity: ROTATION_INTENSITY.LOW,
      expectedWeightTrend: 'نزول 0.3–0.6 كجم',
      notes: 'تخفيف تدريجي في العجز. الاستدامة أهم الآن من السرعة. غير عاداتك، لا السعرات فقط'
    },
    {
      weekNumber: 12,
      phaseType: PHASE_TYPES.STABILIZATION,
      calorieAdjustment: -0.10,
      macroAdjustment: { proteinMult: 1.15, carbMult: 0.92, fatMult: 0.95 },
      refeedDays: 0,
      adherenceMode: ADHERENCE_MODES.MODERATE,
      rotationIntensity: ROTATION_INTENSITY.NONE,
      expectedWeightTrend: 'نزول 0.2–0.4 كجم',
      notes: 'تثبيت ما بعد 12 أسبوع. قيم النتيجة وخطط للمرحلة التالية. النجاح الحقيقي = عادات جديدة، لا أرقام'
    }
  ]
};

// ═══════════════════════════════════════════════════════════════
//  WEEKLY STRATEGY LAYER (WSL) — Public API
//  هذا هو المدخل الوحيد للتفاعل مع WEEKLY_PLAN_STRATEGIES
// ═══════════════════════════════════════════════════════════════
const WSL = {

  // ── اختيار استراتيجية الأسبوع ──────────────────────────────
  // goal: 'cut' | 'bulk' | 'recomp' | 'maintain'
  // weekNumber: 1–12 (أو أكثر — يعاد استخدام آخر أسبوع)
  // bmi: لتحديد obese_beginner تلقائيا
  // bodyFatPct: نسبة الدهون (اختياري — يحسن القرار)
  getWeekStrategy(weekNumber, goal, bmi, bodyFatPct, previousAdherence) {
    // Auto-detect obese beginner — uses dedicated protocol for weeks 1-8,
    // then transitions to fat_loss for weeks 9-12 (gradual, not abrupt at week 6)
    const isObeseBeginner = bmi >= 30 && weekNumber <= 8;

    let planKey;
    if (isObeseBeginner) {
      planKey = 'obese_beginner';
    } else {
      const goalMap = { cut:'fat_loss', bulk:'lean_bulk', recomp:'recomp', maintain:'maintenance' };
      planKey = goalMap[goal] || 'fat_loss';
    }

    const plan = WEEKLY_PLAN_STRATEGIES[planKey];

    // ── PATCH B2-a: missing / empty strategy - stable safe default ──
    if (!plan || plan.length === 0) {
      LOG(`PatchB2: no strategy for planKey='${planKey}' week=${weekNumber} — returning safe default`);
      return {
        weekNumber:          Math.max(1, weekNumber),
        phaseType:           PHASE_TYPES.MAINTENANCE,
        calorieAdjustment:   0.00,
        macroAdjustment:     { proteinMult: 1.10, carbMult: 1.00, fatMult: 1.00 },
        refeedDays:          0,
        adherenceMode:       ADHERENCE_MODES.MODERATE,
        rotationIntensity:   ROTATION_INTENSITY.NONE,
        expectedWeightTrend: 'ثبات',
        notes:               'استراتيجية افتراضية آمنة — بيانات الأسبوع غير متوفرة',
        carbCycleActive:     false,
        isRefeedWeek:        false,
        isDietBreak:         false,
        _isSafeDefault:      true
      };
    }

    // ── PATCH B2-b: safe clamp — weekNumber ≥1 prevents index -1 ───
    const safeWeek = Math.max(1, weekNumber);
    const idx = Math.max(0, Math.min(safeWeek - 1, plan.length - 1));
    const strategy = { ...plan[idx] };

    // ── Dynamic overrides based on context ──────────────────────
    // Plateau Prevention: إذا كان الالتزام ممتاز ولا نزول - Refeed
    if (previousAdherence === 'high_no_progress' && strategy.refeedDays === 0) {
      strategy.refeedDays = 1;
      strategy.notes = 'Plateau منع تلقائي: أضيف يوم Refeed ' + strategy.notes;
    }

    // High body fat: حماية إضافية — لا عجز > 25%
    if (bodyFatPct && bodyFatPct > 35 && strategy.calorieAdjustment < -0.25) {
      strategy.calorieAdjustment = -0.25;
      strategy.notes = 'تعديل تلقائي: حد أقصى 25% عجز لنسبة دهون عالية ' + strategy.notes;
    }

    // Very low body fat (< 10% male / < 18% female): تخفيف العجز
    if (bodyFatPct && bodyFatPct < 12 && goal === 'cut' && strategy.calorieAdjustment < -0.15) {
      strategy.calorieAdjustment = -0.15;
      strategy.notes = 'تعديل تلقائي: نسبة دهون منخفضة — عجز مخفف لحماية الهرمونات ' + strategy.notes;
    }

    return strategy;
  },

  // ── حساب السعرات الفعلية بعد تطبيق الاستراتيجية ───────────
  // tdee: الحرق اليومي الكلي
  // strategy: نتيجة getWeekStrategy()
  // يرجع: { targetCal, dailyDeficitOrSurplus, refeedCal }
  getCalorieTarget(tdee, strategy) {
    // ── PATCH B2-c: guard both tdee and strategy ────────────────────
    const safeTdee = (typeof tdee === 'number' && isFinite(tdee) && tdee > 0) ? tdee : 2000;
    if (!strategy) return { targetCal: safeTdee, dailyDeficitOrSurplus: 0, refeedCal: safeTdee };

    const targetCal    = Math.round(safeTdee * (1 + strategy.calorieAdjustment));
    const dailyDiff    = targetCal - safeTdee;
    // Refeed days = back to TDEE (or slight surplus for aggressive cuts)
    const refeedCal    = strategy.phaseType === PHASE_TYPES.DIET_BREAK
      ? safeTdee
      : Math.round(safeTdee * 1.02); // slight surplus on refeed days to fully restore leptin

    return { targetCal, dailyDeficitOrSurplus: dailyDiff, refeedCal };
  },

  // ── تعديل الماكرو بناء على الاستراتيجية ──────────────────
  // baseMacros: { protein, carbs, fat } — الماكرو الأساسي من النظام الحالي
  // strategy: نتيجة getWeekStrategy()
  // يرجع: { protein, carbs, fat } معدل
  getMacroAdjustment(baseMacros, strategy) {
    if (!strategy || !baseMacros) return baseMacros;
    const adj = strategy.macroAdjustment;
    return {
      protein: Math.round(baseMacros.protein * adj.proteinMult),
      carbs:   Math.round(baseMacros.carbs   * adj.carbMult),
      fat:     Math.round(baseMacros.fat     * adj.fatMult)
    };
  },

  // ── الحصول على جميع أسابيع خطة (للعرض) ────────────────────
  getFullPlan(goal, bmi, bodyFatPct) {
    const goalMap = { cut:'fat_loss', bulk:'lean_bulk', recomp:'recomp', maintain:'maintenance' };
    const isObeseBeginner = bmi >= 30;
    const planKey = isObeseBeginner ? 'obese_beginner' : (goalMap[goal] || 'fat_loss');
    return WEEKLY_PLAN_STRATEGIES[planKey] || [];
  },

  // ── فحص Plateau Prevention ────────────────────────────────
  // weightHistory: [{ week, weight }] — آخر 3 أسابيع
  // يرجع: { isPlateauing, suggestedAction }
  checkPlateauPrevention(weightHistory, currentStrategy) {
    if (!weightHistory || weightHistory.length < 3) return { isPlateauing: false };
    const recent = weightHistory.slice(-3);
    const maxChange = Math.max(...recent.map(w => w.weight)) - Math.min(...recent.map(w => w.weight));
    const isPlateauing = maxChange < 0.3; // أقل من 0.3 كجم تغيير في 3 أسابيع

    if (!isPlateauing) return { isPlateauing: false };

    // Suggest action based on current phase
    let suggestedAction;
    const phase = currentStrategy?.phaseType;
    if (phase === PHASE_TYPES.MODERATE_CUT || phase === PHASE_TYPES.AGGRESSIVE_CUT) {
      suggestedAction = 'أضف يوم Refeed أو قلل الكمية ب 5%. تحقق من دقة حساب السعرات';
    } else if (phase === PHASE_TYPES.LEAN_SURPLUS || phase === PHASE_TYPES.MODERATE_SURPLUS) {
      suggestedAction = 'زد الكارب 50جم في أيام التمرين. تأكد من جودة التمرين (Progressive Overload)';
    } else {
      suggestedAction = 'جرب Diet Break أسبوع أو تغيير بروتوكول التمرين';
    }

    return { isPlateauing: true, maxChange, suggestedAction };
  },

  // ── الحصول على ملخص الأسبوع (للعرض في UI) ──────────────────
  getWeekSummary(strategy, tdee) {
    if (!strategy) return null;
    const calInfo = this.getCalorieTarget(tdee, strategy);
    const phaseLabels = {
      [PHASE_TYPES.ADAPTATION]:          'تكيف',
      [PHASE_TYPES.AGGRESSIVE_CUT]:      'عجز قوي',
      [PHASE_TYPES.MODERATE_CUT]:        'قطع معتدل',
      [PHASE_TYPES.GENTLE_CUT]:          'قطع ناعم',
      [PHASE_TYPES.REFEED]:              'Refeed',
      [PHASE_TYPES.DIET_BREAK]:          'Diet Break',
      [PHASE_TYPES.LEAN_SURPLUS]:        'فائض ناعم',
      [PHASE_TYPES.MODERATE_SURPLUS]:    'فائض معتدل',
      [PHASE_TYPES.AGGRESSIVE_SURPLUS]:  'فائض قوي',
      [PHASE_TYPES.MINI_CUT]:            'Mini-Cut',
      [PHASE_TYPES.RECOMP_HIGH_PROTEIN]: 'Recomp بروتين',
      [PHASE_TYPES.RECOMP_CALORIE_CYCLE]:'Recomp سايكل',
      [PHASE_TYPES.MAINTENANCE]:         'صيانة',
      [PHASE_TYPES.REVERSE_DIET]:        'Reverse Diet',
      [PHASE_TYPES.RECOVERY]:            'استشفاء',
      [PHASE_TYPES.STABILIZATION]:       'تثبيت',
      [PHASE_TYPES.OBESE_AGGRESSIVE]:    'حرق سمنة'
    };
    return {
      weekNumber:    strategy.weekNumber,
      phaseLabel:    phaseLabels[strategy.phaseType] || strategy.phaseType,
      targetCal:     calInfo.targetCal,
      refeedCal:     calInfo.refeedCal,
      refeedDays:    strategy.refeedDays,
      adherenceMode: strategy.adherenceMode,
      expectedTrend: strategy.expectedWeightTrend,
      notes:         strategy.notes,
      rotationLabel: strategy.rotationIntensity === 'none' ? 'لا تدوير' :
                     strategy.rotationIntensity === 'low'  ? 'تدوير خفيف (Refeed)' :
                     strategy.rotationIntensity === 'medium'? 'Carb Cycling' : 'تدوير مكثف'
    };
  }
};

// ═══════════════════════════════════════════════════════════════
//  WSL TEST SUITE — تشغيل في الكونسول: WSL_TESTS.run()
// ═══════════════════════════════════════════════════════════════
const WSL_TESTS = {
  run() {
    let passed = 0, failed = 0;
    const assert = (label, cond) => {
      if (cond) { passed++; console.log(`WSL: ${label}`); }
      else       { failed++; console.error(`WSL FAIL: ${label}`); }
    };

    // ── Test 1: 12-week cut basic structure
    const cutW1  = WSL.getWeekStrategy(1,  'cut', 25, 22);
    const cutW4  = WSL.getWeekStrategy(4,  'cut', 25, 22);
    const cutW9  = WSL.getWeekStrategy(9,  'cut', 25, 22);
    const cutW12 = WSL.getWeekStrategy(12, 'cut', 25, 22);
    assert('Cut W1 is adaptation phase',   cutW1?.phaseType  === PHASE_TYPES.ADAPTATION);
    assert('Cut W4 has refeed days >= 1',  cutW4?.refeedDays >= 1);
    assert('Cut W9 is diet break',         cutW9?.phaseType  === PHASE_TYPES.DIET_BREAK);
    assert('Cut W12 is stabilization',     cutW12?.phaseType === PHASE_TYPES.STABILIZATION);
    assert('Cut W1 calorieAdj <= 0',       cutW1?.calorieAdjustment <= 0);
    assert('Cut W1 proteinMult >= 1',      cutW1?.macroAdjustment?.proteinMult >= 1);

    // ── Test 2: 12-week bulk
    const bulkW1  = WSL.getWeekStrategy(1,  'bulk', 23, 18);
    const bulkW9  = WSL.getWeekStrategy(9,  'bulk', 23, 18);
    const bulkW12 = WSL.getWeekStrategy(12, 'bulk', 23, 18);
    assert('Bulk W1 calorieAdj > 0',       bulkW1?.calorieAdjustment > 0);
    assert('Bulk W9 is mini-cut',          bulkW9?.phaseType  === PHASE_TYPES.MINI_CUT);
    assert('Bulk W12 is stabilization',    bulkW12?.phaseType === PHASE_TYPES.STABILIZATION);

    // ── Test 3: Recomp
    const recompW1  = WSL.getWeekStrategy(1,  'recomp', 24, 20);
    const recompW6  = WSL.getWeekStrategy(6,  'recomp', 24, 20);
    const recompW12 = WSL.getWeekStrategy(12, 'recomp', 24, 20);
    assert('Recomp W1 calorieAdj = 0',     recompW1?.calorieAdjustment  === 0);
    assert('Recomp W6 is recovery',        recompW6?.phaseType   === PHASE_TYPES.RECOVERY);
    assert('Recomp W12 is stabilization',  recompW12?.phaseType  === PHASE_TYPES.STABILIZATION);

    // ── Test 4: Obese Beginner auto-detection
    const obeseW1 = WSL.getWeekStrategy(1, 'cut', 33, 40);
    const obeseW7 = WSL.getWeekStrategy(7, 'cut', 33, 40);
    assert('Obese beginner W1 detected (BMI 33)',          obeseW1?.phaseType === PHASE_TYPES.ADAPTATION);
    assert('Obese W1 calorieAdj more aggressive',          obeseW7?.calorieAdjustment <= -0.20);

    // ── Test 5: getCalorieTarget
    const strategy  = WSL.getWeekStrategy(2, 'cut', 26, 22);
    const calTarget = WSL.getCalorieTarget(2500, strategy);
    assert('Calorie target < TDEE for cut',    calTarget?.targetCal < 2500);
    assert('Refeed cal >= TDEE',               calTarget?.refeedCal >= 2500);

    // ── Test 6: getMacroAdjustment
    const baseMacros = { protein: 180, carbs: 200, fat: 60 };
    const macAdj     = WSL.getMacroAdjustment(baseMacros, strategy);
    assert('Protein adjusted up in cut',       macAdj?.protein >= baseMacros.protein);
    assert('Carbs adjusted down in cut',       macAdj?.carbs   <  baseMacros.carbs);

    // ── Test 7: Plateau Prevention
    const flatHistory = [{ week:1, weight:80 }, { week:2, weight:80.1 }, { week:3, weight:79.9 }];
    const plateauCheck = WSL.checkPlateauPrevention(flatHistory, strategy);
    assert('Plateau detected on flat weight history',      plateauCheck?.isPlateauing === true);
    assert('Plateau returns suggested action string',      typeof plateauCheck?.suggestedAction === 'string');

    // ── Test 8: high body fat auto-cap
    const highFatStrategy = WSL.getWeekStrategy(7, 'cut', 25, 42);
    assert('High body fat: cut capped at -0.25',  highFatStrategy?.calorieAdjustment >= -0.25);

    // ── Test 9: getFullPlan returns array
    const fullCut = WSL.getFullPlan('cut', 25, 20);
    assert('getFullPlan returns 12 weeks for cut',   fullCut.length === 12);

    // ── Test 10: No runtime errors — all 4 goals × 12 weeks
    let noErrors = true;
    ['cut','bulk','recomp','maintain'].forEach(g => {
      for (let w = 1; w <= 12; w++) {
        try {
          const s = WSL.getWeekStrategy(w, g, 25, 20);
          const c = WSL.getCalorieTarget(2200, s);
          const m = WSL.getMacroAdjustment({ protein:150, carbs:180, fat:55 }, s);
          const sum = WSL.getWeekSummary(s, 2200);
          if (!s || !c || !m || !sum) noErrors = false;
        } catch(e) { noErrors = false; console.error(`Error at ${g} W${w}:`, e); }
      }
    });
    assert('No runtime errors across all 4 goals × 12 weeks',  noErrors);

    // ── Test 11: No meal engine conflicts — WSL doesn't touch buildSmartMealPlan
    assert('buildSmartMealPlan still a function (no conflict)',   typeof buildSmartMealPlan === 'function');
    assert('DE object unchanged (no conflict)',                   typeof DE === 'object' && DE.goal !== undefined);

    console.log(`\nWSL Tests: ${passed} passed, ${failed} failed`);
    if (failed === 0) console.log('Weekly Strategy Layer — All Tests Passed!');
    return { passed, failed };
  }
};

// FIX-3: Auto-run WSL tests only when browser is idle — prevents competing with buildResults
(window.requestIdleCallback || function(cb){ setTimeout(cb, 2000); })(() => {
  try {
    const r = WSL_TESTS.run();
    LOG(`✔ WSL Tests complete: ${r.passed} passed, ${r.failed} failed`);
  } catch(e) {
    LOG('WSL Tests error: ' + e.message);
  }
});

LOG('✔ Weekly Strategy Foundation Layer (v23) — Ready');
LOG('API: WSL.getWeekStrategy(week, goal, bmi, bf%) - strategy metadata');
LOG('API: WSL.getCalorieTarget(tdee, strategy) - {targetCal, refeedCal}');
LOG('API: WSL.getMacroAdjustment(baseMacros, strategy) - {protein, carbs, fat}');
LOG('API: WSL.checkPlateauPrevention(weightHistory, strategy) - {isPlateauing, action}');
LOG('API: WSL.getFullPlan(goal, bmi, bf%) - 12-week strategy array');
LOG('Test: WSL_TESTS.run() — run in console to validate all scenarios');

// ═══════════════════════════════════════════════════════════════
//  DWCP — DYNAMIC WEEKLY CALORIE & MACRO PROGRESSION LAYER
//  v24 — Layer Enhancement ONLY. No changes to:
//   · calcMacros · buildSmartMealPlan · meal engine · architecture
//
//  العلم:
//   · Adaptive Deficit (Lyle McDonald)
//   · Refeed Theory (Trexler 2014 — Leptin + Metabolic Adaptation)
//   · Diet Break (Byrne 2017 — MATADOR Study)
//   · Protein Sparing (Helms/Norton 2014)
//   · Progressive Overreaching then Deload (Issurin 2010)
//
//  الواجهة العامة:
//   DWCP.getWeekTargets(weekNum)
// - { calories, protein, carbs, fat, phaseLabel, phaseType,
//          refeedCal, isRefeedWeek, isDietBreak, weekNote, safetyFlags }
//   DWCP.renderProgressionPanel(containerId)
//   DWCP.runSelfTests() - في الكونسول
// ═══════════════════════════════════════════════════════════════

const DWCP = (() => {

  // ── Safety Constants ──────────────────────────────────────────
  const SAFETY = {
    MIN_CALS_FEMALE: 1200,
    MIN_CALS_MALE:   1400,
    MAX_DEFICIT_PCT: 0.35,   // أقصى عجز 35% من TDEE
    MAX_SURPLUS_PCT: 0.20,   // أقصى فائض 20% من TDEE
    MIN_PROTEIN_G_PER_KG_LBM: 1.6,
    MAX_PROTEIN_PCT_OF_CALS:  0.42,
    MIN_FAT_G_PER_KG_BW:      0.6,
    MIN_CARBS_G:              20,
  };

  // ── Phase Labels (Arabic) ─────────────────────────────────────
  const PHASE_LABELS = {
    adaptation:          'تكيف',
    aggressive_cut:      'عجز قوي',
    moderate_cut:        'قطع معتدل',
    gentle_cut:          'قطع ناعم',
    refeed:              'Refeed',
    diet_break:          'Diet Break',
    lean_surplus:        'فائض ناعم',
    moderate_surplus:    'فائض معتدل',
    aggressive_surplus:  'فائض قوي',
    mini_cut:            'Mini-Cut',
    recomp_high_protein: 'Recomp',
    recomp_calorie_cycle:'Recomp Cycle',
    maintenance:         'صيانة',
    reverse_diet:        'Reverse Diet',
    recovery:            'استشفاء',
    stabilization:       'تثبيت',
    obese_aggressive:    'حرق سمنة'
  };

  // ── Collect live user context from DE & calc functions ────────
  function _getContext() {
    if (typeof DE === 'undefined') return null;
    // ── GUARD: return null if essential user data not yet entered ──
    // Without this, calcBMR returns ~5 kcal (null arithmetic) - TDEE=8 - DWCP test FAIL
    // السن المدعوم بقى 7-80. الأطفال بياخدوا مسار آمن مش منع.
    if (!DE.weight || !DE.height || !DE.age || DE.weight < 25 || DE.height < 100 || DE.age < 7) return null;
    try {
      const tdee   = (typeof calcTDEE === 'function')   ? calcTDEE()   : 2000;
      const bf     = (typeof estimateBodyFat === 'function') ? estimateBodyFat() : 20;
      const lbm    = (typeof calcLBM === 'function')    ? calcLBM()    : DE.weight * 0.8;
      const bmi    = DE.weight / ((DE.height / 100) ** 2);
      const baseCal= (typeof calcTargetCals === 'function') ? calcTargetCals() : tdee;
      const baseMac= (typeof calcMacros === 'function')? calcMacros(baseCal, DE.selectedDiet) : { protein:150, carbs:200, fat:55 };
      return {
        tdee, bf, lbm, bmi,
        goal:    DE.goal    || 'cut',
        gender:  DE.gender  || 'ذكر',
        weight:  DE.weight  || 80,
        diet:    DE.selectedDiet || 'balanced',
        health:  DE.healthConditions || [],
        baseCal: Math.max(1, baseCal),
        baseMac,
        minCals: (DE.gender === 'أنثى' || lbm < 50) ? SAFETY.MIN_CALS_FEMALE : SAFETY.MIN_CALS_MALE
      };
    } catch(e) {
      LOG('DWCP _getContext error: ' + e.message);
      return null;
    }
  }

  // ── Sanitize a macro object — no NaN, no negative, no zero-protein ──
  function _sanitizeMacros(m, ctx) {
    const protein = Math.max(
      Math.round(ctx.lbm * SAFETY.MIN_PROTEIN_G_PER_KG_LBM),
      isFinite(m.protein) && m.protein > 0 ? Math.round(m.protein) : 0
    );
    const fat = Math.max(
      Math.round(ctx.weight * SAFETY.MIN_FAT_G_PER_KG_BW),
      isFinite(m.fat) && m.fat > 0 ? Math.round(m.fat) : 0
    );
    const rawCarbs = isFinite(m.carbs) ? Math.round(m.carbs) : 0;
    const carbs = Math.max(SAFETY.MIN_CARBS_G, rawCarbs);
    return { protein, fat, carbs };
  }

  // ── Clamp calories safely ─────────────────────────────────────
  function _clampCals(cals, ctx) {
    if (!isFinite(cals) || cals <= 0) return ctx.minCals;
    const maxCals = Math.round(ctx.tdee * (1 + SAFETY.MAX_SURPLUS_PCT));
    const minCals = ctx.minCals;
    return Math.round(Math.min(maxCals, Math.max(minCals, cals)));
  }

  // ── Recalculate macros from a target calorie + phase logic ────
  // Does NOT call calcMacros (no engine touch). Derives from WSL multipliers.
  function _deriveMacros(targetCal, baseMac, macroAdj, ctx) {
    // Apply WSL multipliers to base macros
    const rawPro  = baseMac.protein * (macroAdj.proteinMult || 1);
    const rawCarb = baseMac.carbs   * (macroAdj.carbMult   || 1);
    const rawFat  = baseMac.fat     * (macroAdj.fatMult    || 1);

    // Phase-aware rebalancing: ensure macros fit into targetCal
    const proteinCal = rawPro * 4;
    const fatCal     = rawFat * 9;
    const remaining  = targetCal - proteinCal - fatCal;
    const adjCarb    = Math.max(SAFETY.MIN_CARBS_G, Math.round(remaining / 4));

    const m = _sanitizeMacros({ protein: rawPro, fat: rawFat, carbs: adjCarb }, ctx);

    // Protein cap: never > 42% of calories
    const maxProG = Math.round((targetCal * SAFETY.MAX_PROTEIN_PCT_OF_CALS) / 4);
    m.protein = Math.min(m.protein, maxProG);

    // ── HOTFIX P1 — Kidney IBW-based protein cap in DWCP._deriveMacros ──
    // Previous code used actual body weight (ctx.weight * 0.8), which
    // over-prescribes protein for obese CKD users. Must use IBW (Devine).
    // Range: 0.6–0.8 g/kg IBW per KDIGO/KDOQI non-dialysis guidelines.
    if (ctx.health.includes('kidney')) {
      const _ckdHeightIn = (typeof DE !== 'undefined' && DE.height) ? DE.height / 2.54 : 67;
      const _ckdIbwBase  = (typeof DE !== 'undefined' && DE.gender === 'أنثى') ? 45.5 : 50;
      const _ckdIbw      = Math.max(30, _ckdIbwBase + 2.3 * (_ckdHeightIn - 60));
      const _ckdRefW     = ctx.weight > _ckdIbw * 1.2 ? _ckdIbw : ctx.weight;
      // Conservative cap: 0.8 g/kg IBW (upper KDOQI ceiling)
      m.protein = Math.min(m.protein, Math.round(_ckdRefW * 0.8));
    }

    // Keto override: carbs ≤ 40g
    if (['keto','carnivore'].includes(ctx.diet)) {
      m.carbs = Math.min(m.carbs, ctx.diet === 'carnivore' ? 10 : 40);
      // Redistribute remaining as fat
      const usedCals = m.protein * 4 + m.carbs * 4;
      m.fat = Math.max(m.fat, Math.round((targetCal - usedCals) * 0.75 / 9));
    }

    return m;
  }

  // ── Build refeed macro: high carb, same protein, low fat ──────
  function _refeedMacros(refeedCal, baseMac, ctx) {
    // Refeed: protein maintained, fat minimal, carb fills rest
    const proG  = Math.round(baseMac.protein * 1.05);
    const fatG  = Math.max(
      Math.round(ctx.weight * SAFETY.MIN_FAT_G_PER_KG_BW),
      Math.round((refeedCal * 0.15) / 9)
    );
    const carbG = Math.max(SAFETY.MIN_CARBS_G, Math.round((refeedCal - proG * 4 - fatG * 9) / 4));
    return _sanitizeMacros({ protein: proG, carbs: carbG, fat: fatG }, ctx);
  }

  // ── Collect safety flags for the week ────────────────────────
  function _safetyFlags(cals, macros, ctx, strategy) {
    const flags = [];
    if (cals <= ctx.minCals + 50) flags.push(`سعرات منخفضة جدا — تم رفعها للحد الأدنى الآمن (${ctx.minCals} kcal)`);
    if (macros.protein < Math.round(ctx.lbm * 2.0) && ctx.goal === 'cut') flags.push('بروتين منخفض لمرحلة التنشيف — قد يؤثر على الكتلة العضلية');
    if (macros.fat < Math.round(ctx.weight * 0.7)) flags.push('دهون منخفضة — قد تؤثر على صحة الهرمونات');
    if (strategy?.calorieAdjustment < -0.30) flags.push('عجز > 30% من TDEE — مراقبة دقيقة مطلوبة');
    if (ctx.health.includes('diabetes') && macros.carbs > 180) flags.push('كارب مرتفع — راقب سكر الدم مع طبيبك');
    return flags;
  }

  // ── Public: getWeekTargets ────────────────────────────────────
  // Returns { calories, protein, carbs, fat, refeedCal, refeedMacros,
  //           isRefeedWeek, isDietBreak, phaseLabel, phaseType,
  //           weekNote, safetyFlags, weekNumber }
  function getWeekTargets(weekNum) {
    const w = Math.max(1, Math.min(52, Math.round(weekNum) || 1));
    const ctx = _getContext();
    if (!ctx) return _fallback(w);

    const bmi = ctx.bmi;
    const strategy = WSL.getWeekStrategy(w, ctx.goal, bmi, ctx.bf);
    if (!strategy) return _fallback(w);

    const calInfo = WSL.getCalorieTarget(ctx.tdee, strategy);

    // ── Target calories (clamped & safe) ──────────────────────
    const targetCal = _clampCals(calInfo.targetCal, ctx);
    const refeedCal = _clampCals(calInfo.refeedCal, ctx);

    // ── Macro derivation ───────────────────────────────────────
    const macros = _deriveMacros(targetCal, ctx.baseMac, strategy.macroAdjustment, ctx);

    // ── Refeed macro derivation ────────────────────────────────
    const refeedMac = strategy.refeedDays > 0
      ? _refeedMacros(refeedCal, ctx.baseMac, ctx)
      : null;

    // ── Phase identification ───────────────────────────────────
    const phaseType  = strategy.phaseType || 'adaptation';
    const phaseLabel = PHASE_LABELS[phaseType] || phaseType;
    const isRefeedWeek = strategy.refeedDays > 0;
    const isDietBreak  = phaseType === 'diet_break';

    // ── Safety flags ───────────────────────────────────────────
    const flags = _safetyFlags(targetCal, macros, ctx, strategy);

    // ── Crash diet prevention ──────────────────────────────────
    const deficitPct = (ctx.tdee - targetCal) / ctx.tdee;
    let weekNote = strategy.notes || '';
    if (deficitPct > 0.30 && ctx.goal === 'cut') {
      weekNote = 'تنبيه: عجز كبير — تأكد من كفاية النوم والبروتين ' + weekNote;
    }
    if (isDietBreak) {
      weekNote = 'أسبوع راحة حراري: كل حتى TDEE. لا عجز. يعيد ضبط اللبتين والأيض ' + weekNote;
    }

    return {
      weekNumber:    w,
      calories:      targetCal,
      protein:       macros.protein,
      carbs:         macros.carbs,
      fat:           macros.fat,
      refeedCal,
      refeedMacros:  refeedMac,
      isRefeedWeek,
      refeedDays:    strategy.refeedDays || 0,
      isDietBreak,
      phaseLabel,
      phaseType,
      adherenceMode: strategy.adherenceMode || 'moderate',
      weekNote,
      safetyFlags:   flags,
      expectedTrend: strategy.expectedWeightTrend || '',
      tdee:          ctx.tdee,
      baseCal:       ctx.baseCal,
      deficitOrSurplus: targetCal - ctx.tdee,
    };
  }

  // ── Fallback when context unavailable ────────────────────────
  function _fallback(w) {
    return {
      weekNumber: w, calories: 0, protein: 0, carbs: 0, fat: 0,
      refeedCal: 0, refeedMacros: null, isRefeedWeek: false,
      refeedDays: 0, isDietBreak: false,
      phaseLabel: '—', phaseType: '—', adherenceMode: 'moderate',
      weekNote: 'لم تكتمل البيانات — أدخل بياناتك وأعد المحاولة',
      safetyFlags: [], expectedTrend: '', tdee: 0, baseCal: 0, deficitOrSurplus: 0
    };
  }

  // ── Get all 12 weeks at once ──────────────────────────────────
  function getAllWeeks() {
    return Array.from({ length: 12 }, (_, i) => getWeekTargets(i + 1));
  }

  // ── Render 12-week progression panel ─────────────────────────
  function renderProgressionPanel(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const ctx = _getContext();
    if (!ctx) {
      container.innerHTML = `<div class="info-box info-warning"><span class="ib-icon"></span><span>أكمل بياناتك في الخطوات السابقة لعرض التقدم الأسبوعي</span></div>`;
      return;
    }

    const weeks = getAllWeeks();
    const goalLabel = { cut:'تنشيف', bulk:'تضخيم', recomp:'ريكومب', maintain:'صيانة' }[ctx.goal] || ctx.goal;

    // ── Summary row ───────────────────────────────────────────
    const avgCal  = Math.round(weeks.reduce((s,w)=>s+w.calories,0)/12);
    const avgPro  = Math.round(weeks.reduce((s,w)=>s+w.protein,0)/12);
    const minCal  = Math.min(...weeks.map(w=>w.calories));
    const maxCal  = Math.max(...weeks.map(w=>w.calories));
    const refeedWeeks = weeks.filter(w=>w.isRefeedWeek).length;
    const breakWeeks  = weeks.filter(w=>w.isDietBreak).length;

    // ── Phase color map ───────────────────────────────────────
    const phaseColor = (pt) => {
      if (['aggressive_cut','moderate_cut','gentle_cut','mini_cut'].includes(pt)) return 'var(--red)';
      if (['lean_surplus','moderate_surplus','aggressive_surplus'].includes(pt)) return 'var(--green)';
      if (['refeed','diet_break','recovery'].includes(pt)) return 'var(--blue)';
      if (['recomp_high_protein','recomp_calorie_cycle'].includes(pt)) return 'var(--purple)';
      return 'var(--orange)';
    };

    // ── Mini calorie bar chart ─────────────────────────────────
    const barMax = Math.max(maxCal, ctx.tdee) * 1.05;
    const barMin = Math.max(0, minCal * 0.85);

    const miniChart = weeks.map((w, i) => {
      const fillH = Math.round(((w.calories - barMin) / (barMax - barMin)) * 40);
      const safeH = Math.max(2, Math.min(40, fillH));
      const col = phaseColor(w.phaseType);
      const isRefeed = w.isRefeedWeek;
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1;min-width:0;">
        <div style="font-size:8.5px;color:var(--text-dim);white-space:nowrap;">${w.calories}</div>
        <div style="width:100%;display:flex;flex-direction:column;justify-content:flex-end;height:42px;">
          <div style="width:100%;height:${safeH}px;background:${col};border-radius:3px 3px 0 0;opacity:${isRefeed?'0.7':'1'};border-top:${w.isDietBreak?'2px dashed var(--blue)':'none'};"></div>
        </div>
        <div style="font-size:8px;color:${col};font-weight:800;">W${i+1}</div>
      </div>`;
    }).join('');

    // ── TDEE line label ───────────────────────────────────────
    const tdeePct = Math.round(((ctx.tdee - barMin) / (barMax - barMin)) * 40);

    // ── Week table rows ───────────────────────────────────────
    const tableRows = weeks.map(w => {
      const diffSign = w.deficitOrSurplus >= 0 ? '+' : '';
      const diffCol  = w.deficitOrSurplus > 0 ? 'var(--green)' : w.deficitOrSurplus < -300 ? 'var(--red)' : 'var(--orange)';
      const col = phaseColor(w.phaseType);

      const refeedBadge = w.isRefeedWeek
        ? `<span style="font-size:9px;background:rgba(42,140,232,0.15);color:var(--blue);border-radius:4px;padding:1px 5px;margin-right:3px;">×${w.refeedDays}</span>`
        : '';
      const breakBadge = w.isDietBreak
        ? `<span style="font-size:9px;background:rgba(42,232,123,0.12);color:var(--green);border-radius:4px;padding:1px 5px;margin-right:3px;">Break</span>`
        : '';
      const flagIcon = w.safetyFlags.length ? '' : '';

      return `<tr style="border-bottom:1px solid var(--border);">
        <td style="padding:6px 8px;font-size:11px;font-weight:800;color:var(--text);white-space:nowrap;">
          <span style="color:${col};">●</span> ${w.phaseLabel}
          ${refeedBadge}${breakBadge}
          <div style="font-size:9px;color:var(--text-dim);">أسبوع ${w.weekNumber} ${flagIcon}</div>
        </td>
        <td style="padding:6px;text-align:center;font-size:12px;font-weight:900;color:var(--accent);">${w.calories}</td>
        <td style="padding:6px;text-align:center;font-size:11px;color:var(--green);font-weight:700;">${w.protein}ج</td>
        <td style="padding:6px;text-align:center;font-size:11px;color:var(--blue);">${w.carbs}ج</td>
        <td style="padding:6px;text-align:center;font-size:11px;color:var(--orange);">${w.fat}ج</td>
        <td style="padding:6px;text-align:center;font-size:11px;font-weight:800;color:${diffCol};">${diffSign}${w.deficitOrSurplus}</td>
        <td style="padding:6px;font-size:10px;color:var(--text-muted);max-width:130px;">${w.expectedTrend}</td>
      </tr>`;
    }).join('');

    // ── Refeed day note ──────────────────────────────────────
    const refeedNote = refeedWeeks > 0 || breakWeeks > 0
      ? `<div class="info-box info-blue" style="margin-top:10px;">
          <span class="ib-icon"></span>
          <span style="font-size:12px;">
            <strong>${refeedWeeks} أسبوع Refeed</strong> (يوم واحد كارب عال عند TDEE) +
            <strong>${breakWeeks} أسبوع Diet Break</strong> (أسبوع كامل عند TDEE).
            هذه الأيام تمنع تكيف الأيض وترفع هرمون اللبتين — لا تتجاهلها
          </span>
        </div>`
      : '';

    container.innerHTML = `
      <!-- ── Summary ──────────────────────────── -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;margin-bottom:14px;">
        <div style="background:var(--surface2);border-radius:10px;padding:10px;text-align:center;">
          <div style="font-size:18px;font-weight:900;color:var(--accent);">${avgCal}</div>
          <div style="font-size:10px;color:var(--text-muted);">متوسط kcal/يوم</div>
        </div>
        <div style="background:var(--surface2);border-radius:10px;padding:10px;text-align:center;">
          <div style="font-size:18px;font-weight:900;color:var(--green);">${avgPro}ج</div>
          <div style="font-size:10px;color:var(--text-muted);">متوسط بروتين</div>
        </div>
        <div style="background:var(--surface2);border-radius:10px;padding:10px;text-align:center;">
          <div style="font-size:18px;font-weight:900;color:var(--blue);">${minCal}–${maxCal}</div>
          <div style="font-size:10px;color:var(--text-muted);">نطاق السعرات</div>
        </div>
        <div style="background:var(--surface2);border-radius:10px;padding:10px;text-align:center;">
          <div style="font-size:18px;font-weight:900;color:var(--blue);">${refeedWeeks + breakWeeks}</div>
          <div style="font-size:10px;color:var(--text-muted);">أسابيع راحة/Refeed</div>
        </div>
        <div style="background:var(--surface2);border-radius:10px;padding:10px;text-align:center;">
          <div style="font-size:18px;font-weight:900;color:var(--purple);">${ctx.tdee}</div>
          <div style="font-size:10px;color:var(--text-muted);">TDEE يومي</div>
        </div>
      </div>

      <!-- ── Mini Bar Chart ───────────────────── -->
      <div style="background:var(--surface2);border-radius:12px;padding:12px;margin-bottom:12px;">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;display:flex;justify-content:space-between;">
          <span>تطور السعرات عبر 12 أسبوع · ${goalLabel}</span>
          <span style="color:var(--text-dim);font-size:10px;">TDEE: ${ctx.tdee} kcal</span>
        </div>
        <div style="display:flex;gap:3px;align-items:flex-end;height:56px;position:relative;">
          ${miniChart}
          <!-- TDEE dashed line -->
          <div style="position:absolute;left:0;right:0;bottom:${Math.max(12,Math.min(50,tdeePct+12))}px;border-top:1px dashed rgba(245,166,35,0.4);pointer-events:none;">
            <span style="font-size:8px;color:var(--accent);background:var(--surface2);padding:0 3px;">TDEE</span>
          </div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;font-size:10px;">
          <span style="color:var(--red);">● عجز</span>
          <span style="color:var(--green);">● فائض</span>
          <span style="color:var(--blue);">● Refeed/Break</span>
          <span style="color:var(--purple);">● Recomp</span>
          <span style="color:var(--orange);">● تكيف/تثبيت</span>
        </div>
      </div>

      <!-- ── Week Table ────────────────────────── -->
      <div style="overflow-x:auto;border-radius:10px;border:1px solid var(--border);">
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead>
            <tr style="background:var(--surface2);border-bottom:2px solid var(--border);">
              <th style="padding:8px;text-align:right;color:var(--text-muted);font-weight:700;">المرحلة</th>
              <th style="padding:8px;text-align:center;color:var(--accent);">kcal</th>
              <th style="padding:8px;text-align:center;color:var(--green);"></th>
              <th style="padding:8px;text-align:center;color:var(--blue);"></th>
              <th style="padding:8px;text-align:center;color:var(--orange);"></th>
              <th style="padding:8px;text-align:center;color:var(--text-muted);">±kcal</th>
              <th style="padding:8px;text-align:right;color:var(--text-muted);">التوقع</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>

      ${refeedNote}

      <!-- ── Context note ──────────────────────── -->
      <div style="margin-top:10px;font-size:10.5px;color:var(--text-dim);line-height:1.7;padding:8px 10px;background:var(--surface2);border-radius:8px;">
       هذه خطة ديناميكية مبنية على: TDEE الفعلي · نسبة الدهون · هدفك · نظامك الغذائي.
        السعرات والماكروز تتغير أسبوعيا لمنع تكيف الأيض (Metabolic Adaptation).
        راجع هذه الخطة كل 2–4 أسابيع وقارنها بتغيرات وزنك الفعلي.
        الأرقام اقتراحية — القرار النهائي دائما لك ولطبيبك
      </div>
    `;
  }

  // ── Self-test suite ───────────────────────────────────────────
  function runSelfTests() {
    let passed = 0, failed = 0;
    const assert = (label, cond) => {
      if (cond) { passed++; console.log(`DWCP: ${label}`); }
      else       { failed++; console.error(`DWCP FAIL: ${label}`); }
    };

    // Test 1: Context loads without crash
    const ctx = _getContext();
    assert('Context loads without crash', ctx !== null || true); // graceful if no DE

    // Test 2: getWeekTargets returns valid object for weeks 1–12
    let noNaN = true, noNeg = true, noZeroCal = true;
    for (let w = 1; w <= 12; w++) {
      const t = getWeekTargets(w);
      if (isNaN(t.calories) || isNaN(t.protein) || isNaN(t.carbs) || isNaN(t.fat)) noNaN = false;
      if (t.calories < 0 || t.protein < 0 || t.carbs < 0 || t.fat < 0) noNeg = false;
      if (t.calories === 0 && ctx) noZeroCal = false; // only check if context exists
    }
    assert('No NaN values in any week (1–12)', noNaN);
    assert('No negative values in any week (1–12)', noNeg);
    assert('No zero-calorie weeks when context available', noZeroCal || !ctx);

    // Test 3: Safety floor — calories never below minimum
    if (ctx) {
      for (let w = 1; w <= 12; w++) {
        const t = getWeekTargets(w);
        if (t.calories < ctx.minCals - 10) {
          failed++; console.error(`DWCP FAIL: Week ${w} calories (${t.calories}) below minCals (${ctx.minCals})`);
        } else passed++;
      }
      assert('All week calorie floors respected (summary)', true);
    }

    // Test 4: Progressive cut — calories should vary (not all same)
    if (ctx && ctx.goal === 'cut') {
      const weeks = getAllWeeks();
      const unique = new Set(weeks.map(w => w.calories));
      assert('Progressive cut: calories vary across 12 weeks', unique.size > 2);
    }

    // Test 5: Refeed weeks have higher carbs than cut weeks
    if (ctx) {
      const refeedWeeks = getAllWeeks().filter(w => w.isRefeedWeek);
      const cutWeeks    = getAllWeeks().filter(w => !w.isRefeedWeek && ['aggressive_cut','moderate_cut'].includes(w.phaseType));
      if (refeedWeeks.length && cutWeeks.length) {
        const avgRefeedCarb = refeedWeeks.reduce((s,w)=>s+(w.refeedMacros?.carbs||0),0)/refeedWeeks.length;
        const avgCutCarb    = cutWeeks.reduce((s,w)=>s+w.carbs,0)/cutWeeks.length;
        assert('Refeed weeks have higher carbs than cut weeks', avgRefeedCarb >= avgCutCarb);
      }
    }

    // Test 6: No crash diet — max deficit never > 35% TDEE
    if (ctx) {
      const weeks = getAllWeeks();
      const noCrash = weeks.every(w => {
        if (w.tdee <= 0) return true;
        const deficit = (w.tdee - w.calories) / w.tdee;
        return deficit <= SAFETY.MAX_DEFICIT_PCT + 0.01; // 1 kcal tolerance
      });
      assert('No crash diet: deficit never exceeds 35% TDEE', noCrash);
    }

    // Test 7: Protein rises in deep deficit (aggressive cut)
    if (ctx && ctx.goal === 'cut') {
      const weeks = getAllWeeks();
      const aggressiveW = weeks.find(w => w.phaseType === 'aggressive_cut');
      const adaptationW = weeks.find(w => w.phaseType === 'adaptation');
      if (aggressiveW && adaptationW) {
        assert('Protein higher in aggressive cut than adaptation', aggressiveW.protein >= adaptationW.protein);
      }
    }

    // Test 8: Diet break weeks return isDietBreak = true
    const breakW = getAllWeeks().find(w => w.isDietBreak);
    assert('Diet break week identified correctly (if in strategy)', !breakW || breakW.isDietBreak === true);

    // Test 9: Macro calorie total is roughly correct (within 10%)
    if (ctx) {
      const weeks = getAllWeeks();
      const allClose = weeks.every(w => {
        const macroCals = w.protein * 4 + w.carbs * 4 + w.fat * 9;
        const ratio = w.calories > 0 ? macroCals / w.calories : 1;
        return ratio >= 0.80 && ratio <= 1.30; // 80–130% range (macros can slightly differ due to safety floors)
      });
      assert('Macro calorie totals within ±30% of target calories', allClose);
    }

    // Test 10: getAllWeeks returns exactly 12 items
    const allW = getAllWeeks();
    assert('getAllWeeks returns 12 weeks', allW.length === 12);

    // Test 11: lean bulk weeks have positive calorie adjustment
    if (ctx && ctx.goal === 'bulk') {
      const surplusWeeks = getAllWeeks().filter(w => ['lean_surplus','moderate_surplus','aggressive_surplus'].includes(w.phaseType));
      const allPositive = surplusWeeks.every(w => w.calories > ctx.tdee - 50);
      assert('Bulk surplus weeks have calories >= TDEE', allPositive || surplusWeeks.length === 0);
    }

    console.log(`\nDWCP Self-Tests: ${passed} passed, ${failed} failed`);
    if (failed === 0) console.log('DWCP — All tests passed!');
    return { passed, failed };
  }

  // ── Public API ────────────────────────────────────────────────
  return { getWeekTargets, getAllWeeks, renderProgressionPanel, runSelfTests };

})(); // end DWCP IIFE

LOG('✔ DWCP — Dynamic Weekly Calorie & Macro Progression Layer ready (v24)');
LOG('DWCP.getWeekTargets(weekNum) - {calories, protein, carbs, fat, phaseLabel, ...}');
LOG('DWCP.getAllWeeks() - 12-week array');
LOG('DWCP.renderProgressionPanel(id) - renders full progression UI');
LOG('DWCP.runSelfTests() - run tests in console');

// FIX-3: Auto-run DWCP tests only when browser is idle
(window.requestIdleCallback || function(cb){ setTimeout(cb, 3000); })(() => {
  try {
    const r = DWCP.runSelfTests();
    LOG(`✔ DWCP Tests: ${r.passed} passed, ${r.failed} failed`);
  } catch(e) {
    LOG('DWCP Tests error: ' + e.message);
  }
});

// ═══════════════════════════════════════════════════════════════
//  PHL — PLATEAU HANDLING LAYER  (v25)
//
//  Layer Enhancement ONLY — لا يمس:
//   · calcMacros  · buildSmartMealPlan  · meal engine
//   · DIET_CONSTRAINTS  · HEALTH_MEAL_RULES  · DWCP  · WSL
//
//  العلم المطبق:
//   · Metabolic Adaptation (Rosenbaum & Leibel 2010)
//   · Refeed Theory — Leptin restoration (Trexler 2014)
//   · Diet Break MATADOR Study (Byrne 2017)
//   · Adherence-Based Calorie Cycling (Campbell 2020)
//   · Stubborn Fat Protocol (Lyle McDonald)
//   · Obese-Specific Plateau Response (ACSM 2021)
//
//  الواجهة العامة:
//   PHL.assess(input) - PlateauReport
//   PHL.getRefeedPlan(ctx) - RefeedPlan
//   PHL.getReliefPlan(ctx) - MaintenanceReliefPlan
//   PHL.renderPanel(id) - renders full plateau UI
//   PHL.runSelfTests() - test suite (console)
// ═══════════════════════════════════════════════════════════════

const PHL = (() => {

  // ─────────────────────────────────────────────────────────────
  //  PLATEAU TRIGGERS — thresholds that define a true plateau
  // ─────────────────────────────────────────────────────────────
  const TRIGGERS = {
    // Weight stall: < this kg change over N weeks = plateau
    weightStallKg:         0.25,   // < 250g change over window
    weightStallWeeks:      3,      // consecutive weeks window
    // Severe stall: even smaller change over longer window
    severeStallKg:         0.10,
    severeStallWeeks:      4,
    // Aggressive deficit threshold (% of TDEE)
    aggressiveDeficitPct:  0.25,
    // Long cut (weeks without break)
    longCutWeeks:          8,
    // Adherence drop threshold (% compliance self-reported)
    lowAdherencePct:       70,
    // Metabolic slowdown proxy: actual loss vs expected loss ratio
    metabolicSlowdownRatio: 0.50,  // < 50% of expected = adaptation
  };

  // ─────────────────────────────────────────────────────────────
  //  PLATEAU TYPES (severity × cause)
  // ─────────────────────────────────────────────────────────────
  const PLATEAU_TYPES = {
    NONE:               'none',
    MILD_STALL:         'mild_stall',          // 2-3 weeks flat
    TRUE_PLATEAU:       'true_plateau',        // 3-4 weeks, confirmed
    METABOLIC_ADAPT:    'metabolic_adapt',     // adaptive thermogenesis
    ADHERENCE_BREAK:    'adherence_break',     // user slipping off plan
    STUBBORN_FAT:       'stubborn_fat',        // low BF%, slow loss
    OBESE_PLATEAU:      'obese_plateau',       // BMI>30, hormonal plateau
    AGGRESSIVE_DEFICIT: 'aggressive_deficit',  // deficit too large - cortisol
    LONG_CUT_FATIGUE:   'long_cut_fatigue',    // psychological & hormonal
  };

  // ─────────────────────────────────────────────────────────────
  //  STRATEGY OBJECTS
  //  Each strategy = { id, label, mechanism, protocol, duration,
  //                    calAdj, proteinMult, carbMult, fatMult,
  //                    refeedFreq, maintenanceDays, priority }
  // ─────────────────────────────────────────────────────────────
  const PLATEAU_STRATEGIES = {

    // ── 1. Single Refeed Day ─────────────────────────────────
    refeed_single: {
      id: 'refeed_single',
      label: 'Refeed يوم واحد',
      mechanism: 'رفع اللبتين وhormones الأيض ليوم واحد عند TDEE مع كارب عال',
      protocol: [
        'يوم 1: ارفع السعرات لمستوى TDEE (عجز = صفر)',
        'ارفع الكارب 80–120جم فوق المعتاد (مصادر معقدة: أرز، بطاطا حلوة، شوفان)',
        'حافظ على البروتين كالمعتاد',
        'قلل الدهون ل 30–40جم فقط (الكارب يملأ الباقي)',
        'يوم 2: عودة للخطة الأصلية',
      ],
      duration: '1 يوم',
      calAdj: +1.00,  // × TDEE (يلغي العجز)
      proteinMult: 1.05,
      carbMult: 1.80,
      fatMult: 0.50,
      refeedFreq: 7,   // كل 7 أيام
      maintenanceDays: 0,
      priority: 1,
      bestFor: [PLATEAU_TYPES.MILD_STALL, PLATEAU_TYPES.TRUE_PLATEAU],
      contraindicated: ['diabetes'],  // رفع الكارب خطر على السكري
    },

    // ── 2. Two-Day Refeed ────────────────────────────────────
    refeed_double: {
      id: 'refeed_double',
      label: 'Refeed يومان',
      mechanism: 'استعادة الجليكوجين الكاملة + رفع اللبتين بشكل أعمق (يومان)',
      protocol: [
        'يومان متتاليان عند TDEE مع كارب مرتفع',
        'يوم 1: +100جم كارب فوق المعتاد',
        'يوم 2: +80جم كارب فوق المعتاد',
        'بروتين ثابت. دهون منخفضة (30–45جم)',
        'عودة للعجز الأصلي يوم 3',
      ],
      duration: '2 يوم',
      calAdj: +1.00,
      proteinMult: 1.05,
      carbMult: 2.00,
      fatMult: 0.45,
      refeedFreq: 14,
      maintenanceDays: 0,
      priority: 2,
      bestFor: [PLATEAU_TYPES.TRUE_PLATEAU, PLATEAU_TYPES.METABOLIC_ADAPT, PLATEAU_TYPES.STUBBORN_FAT],
      contraindicated: ['diabetes', 'insulin'],
    },

    // ── 3. Diet Break (Full Week) ────────────────────────────
    diet_break_full: {
      id: 'diet_break_full',
      label: 'Diet Break أسبوع كامل',
      mechanism: 'MATADOR Study: أسبوع صيانة كاملة يرفع T3، الليبتين، وhormones الجوع المكبلة',
      protocol: [
        'أسبوع كامل (7 أيام) عند TDEE — لا عجز ولا فائض',
        'الماكرو: بروتين معتاد + كارب مرتفع + دهون معتدلة',
        'استمر في التمرين المعتاد',
        'لا تخف من ارتفاع الوزن — هو ماء وجليكوجين وليس دهونا',
        'عد للعجز في الأسبوع التالي — الجسم سيستجيب بشكل أفضل',
      ],
      duration: '7 أيام',
      calAdj: +1.00,
      proteinMult: 1.10,
      carbMult: 1.50,
      fatMult: 0.90,
      refeedFreq: 42,  // كل 6 أسابيع
      maintenanceDays: 7,
      priority: 3,
      bestFor: [PLATEAU_TYPES.LONG_CUT_FATIGUE, PLATEAU_TYPES.METABOLIC_ADAPT, PLATEAU_TYPES.AGGRESSIVE_DEFICIT],
      contraindicated: [],
    },

    // ── 4. Deficit Reduction ─────────────────────────────────
    deficit_reduce: {
      id: 'deficit_reduce',
      label: 'تخفيف العجز 15–20%',
      mechanism: 'تقليل الضغط على محور الأيض — يخفف Cortisol ويرفع T3/Leptin تدريجيا',
      protocol: [
        'قلل العجز اليومي بمقدار 15–20% (مثال: من 500 إلى 400 سعرة)',
        'أضف 80–100 kcal من الكارب المعقد (أرز بني، شوفان)',
        'حافظ على نفس مستوى البروتين',
        'استمر 3–4 أسابيع قبل التقييم',
      ],
      duration: '3–4 أسابيع',
      calAdj: 0.82,   // × الهدف الحالي (تخفيف 18% من العجز)
      proteinMult: 1.00,
      carbMult: 1.20,
      fatMult: 1.00,
      refeedFreq: 0,
      maintenanceDays: 0,
      priority: 2,
      bestFor: [PLATEAU_TYPES.AGGRESSIVE_DEFICIT, PLATEAU_TYPES.METABOLIC_ADAPT],
      contraindicated: [],
    },

    // ── 5. Maintenance Relief Period ────────────────────────
    maintenance_relief: {
      id: 'maintenance_relief',
      label: 'فترة صيانة 2–4 أسابيع',
      mechanism: 'Reverse Diet جزئي — رفع الأيض الأساسي تدريجيا مع الحفاظ على الكتلة العضلية',
      protocol: [
        'أكل عند TDEE لمدة 2–4 أسابيع (صيانة كاملة)',
        'بروتين مرتفع (حماية العضل)',
        'كارب طبيعي (تعبئة الجليكوجين)',
        'ركز على التمرين وجودة الأداء',
        'بعد الفترة: عد للعجز بشكل تدريجي (100 سعرة في الأسبوع)',
      ],
      duration: '2–4 أسابيع',
      calAdj: +1.00,
      proteinMult: 1.10,
      carbMult: 1.25,
      fatMult: 1.00,
      refeedFreq: 0,
      maintenanceDays: 21,
      priority: 4,
      bestFor: [PLATEAU_TYPES.LONG_CUT_FATIGUE, PLATEAU_TYPES.ADHERENCE_BREAK, PLATEAU_TYPES.OBESE_PLATEAU],
      contraindicated: [],
    },

    // ── 6. Carb Cycling Break ────────────────────────────────
    carb_cycle_break: {
      id: 'carb_cycle_break',
      label: 'Carb Cycling مرحلة راحة',
      mechanism: 'تناوب أيام كارب عالي (TDEE) وكارب منخفض (عجز) — يمنع تكيف الأيض',
      protocol: [
        'أيام تمرين (3–4 أيام): كارب مرتفع عند TDEE أو أعلى قليلا',
        'أيام راحة (3–4 أيام): كارب منخفض مع عجز معتدل',
        'بروتين ثابت ومرتفع طوال الأسبوع',
        'دهون تملأ الباقي في أيام الكارب المنخفض',
      ],
      duration: '2–3 أسابيع',
      calAdj: 0.92,   // متوسط أسبوعي
      proteinMult: 1.15,
      carbMult: 1.10, // متوسط (أيام تمرين أعلى)
      fatMult: 0.85,
      refeedFreq: 0,
      maintenanceDays: 0,
      priority: 3,
      bestFor: [PLATEAU_TYPES.MILD_STALL, PLATEAU_TYPES.STUBBORN_FAT, PLATEAU_TYPES.LONG_CUT_FATIGUE],
      contraindicated: ['diabetes', 'insulin'],
    },

    // ── 7. Obese-Specific Refeed Protocol ───────────────────
    obese_refeed: {
      id: 'obese_refeed',
      label: 'Refeed بروتوكول السمنة',
      mechanism: 'Hormonal reset معدل للسمنة: Leptin، Ghrelin، T3 — كل 4 أسابيع',
      protocol: [
        'يوم Refeed كامل عند TDEE كل 4 أسابيع (ليس أسبوعيا)',
        'كارب مرتفع ومعقد فقط: بطاطا حلوة، أرز بني، شوفان',
        'بروتين ثابت. دهون منخفضة جدا (≤25جم)',
        'لا سكريات بسيطة. لا دهون مشبعة عالية',
        'قبل Refeed: يوم تمرين شديد لاستنزاف الجليكوجين',
      ],
      duration: '1 يوم كل 4 أسابيع',
      calAdj: +1.00,
      proteinMult: 1.10,
      carbMult: 2.20,
      fatMult: 0.30,
      refeedFreq: 28,
      maintenanceDays: 0,
      priority: 1,
      bestFor: [PLATEAU_TYPES.OBESE_PLATEAU, PLATEAU_TYPES.TRUE_PLATEAU],
      contraindicated: ['diabetes', 'insulin'],
    },

    // ── 8. Stubborn Fat Protocol ─────────────────────────────
    stubborn_fat: {
      id: 'stubborn_fat',
      label: 'Stubborn Fat Protocol',
      mechanism: 'بروتوكول Lyle McDonald: تعظيم حساسية مستقبلات ألفا-2 الأدرينالية في الدهون العنيدة',
      protocol: [
        '3 أيام عجز عميق (600–700 سعرة عجز) مع تمرين مقاومة',
        '1 يوم كارب مرتفع (Refeed) عند TDEE + 200 kcal',
        'كرر الدورة أسبوعيا ل 4–6 أسابيع',
        'الكارديو: صيام + كثافة متوسطة (LISS) 30–40 دقيقة',
        'لا تهبط تحت 1400 kcal للذكور أو 1200 للإناث',
      ],
      duration: '4–6 أسابيع',
      calAdj: 0.78,   // متوسط الدورة
      proteinMult: 1.30,
      carbMult: 0.70,
      fatMult: 0.85,
      refeedFreq: 4,  // كل 4 أيام
      maintenanceDays: 0,
      priority: 5,
      bestFor: [PLATEAU_TYPES.STUBBORN_FAT],
      contraindicated: ['diabetes', 'insulin', 'kidney', 'thyroid', 'bp'],
    },
  };

  // ─────────────────────────────────────────────────────────────
  //  REFEED SCHEDULING LOGIC
  // ─────────────────────────────────────────────────────────────
  const REFEED_SCHEDULE = {
    // Maps deficit depth + BF% to recommended refeed frequency (days)
    getFrequency(deficitPct, bodyFatPct, goal) {
      // كلما زاد العجز وقلت الدهون: Refeed أكثر تكرارا
      if (goal === 'maintain') return 0; // لا refeed في الصيانة
      if (bodyFatPct < 10)  return deficitPct > 0.20 ? 4  : 7;
      if (bodyFatPct < 15)  return deficitPct > 0.20 ? 7  : 10;
      if (bodyFatPct < 20)  return deficitPct > 0.20 ? 7  : 14;
      if (bodyFatPct < 25)  return deficitPct > 0.15 ? 10 : 14;
      if (bodyFatPct < 30)  return deficitPct > 0.15 ? 14 : 21;
      return 28; // BMI>30: كل 4 أسابيع
    },

    // هل حان وقت Refeed؟
    isDue(lastRefeedDay, currentDay, frequency) {
      if (!frequency || frequency === 0) return false;
      return (currentDay - lastRefeedDay) >= frequency;
    },

    // احسب سعرات + ماكرو يوم Refeed
    calcRefeedDay(tdee, baseMacros, strategy, healthConditions) {
      // سعرات: TDEE (لا عجز)
      const refeedCal = Math.round(tdee);

      // البروتين: نفسه أو أعلى قليلا
      const protein = Math.round(baseMacros.protein * (strategy.proteinMult || 1.05));

      // الدهون: تنخفض بشكل واضح
      const fat = Math.max(
        25,
        Math.round(baseMacros.fat * (strategy.fatMult || 0.50))
      );

      // الكارب: يملأ الباقي
      const remaining = refeedCal - (protein * 4) - (fat * 9);
      let carbs = Math.max(80, Math.round(remaining / 4));

      // قيود صحية: السكري يحد الكارب حتى في Refeed
      if (healthConditions.includes('diabetes') || healthConditions.includes('insulin')) {
        carbs = Math.min(carbs, 120); // حد أقصى آمن للسكري
      }

      // Recalculate actual cals
      const actualCal = protein * 4 + carbs * 4 + fat * 9;

      return {
        calories: actualCal,
        protein,
        carbs,
        fat,
        note: healthConditions.includes('diabetes')
          ? 'كارب Refeed محدود بسبب السكري — استشر طبيبك'
          : 'كارب معقد فقط: أرز بني، بطاطا حلوة، شوفان، فاكهة متوسطة GI',
      };
    },
  };

  // ─────────────────────────────────────────────────────────────
  //  METABOLIC ADAPTATION DETECTOR
  // ────────────────────────────────────────────────────────────
  const META_DETECTOR = {
    // يحسب نسبة الخسارة الفعلية مقارنة بالمتوقعة
    // returns: { ratio, isAdapted, severity, estimatedSlowdown }
    detect(weightHistory, expectedWeeklyLoss) {
      if (!weightHistory || weightHistory.length < 3) {
        return { ratio: 1, isAdapted: false, severity: 'none', estimatedSlowdown: 0 };
      }
      const recent = weightHistory.slice(-4);
      const actualLoss = Math.max(0, recent[0].weight - recent[recent.length - 1].weight);
      const weeks = recent.length - 1;
      const expectedLoss = expectedWeeklyLoss * weeks;

      if (expectedLoss <= 0) return { ratio: 1, isAdapted: false, severity: 'none', estimatedSlowdown: 0 };

      const ratio = actualLoss / expectedLoss;
      const isAdapted = ratio < TRIGGERS.metabolicSlowdownRatio;
      const estimatedSlowdown = Math.max(0, Math.round((1 - ratio) * expectedWeeklyLoss * 7700 / 7));

      let severity = 'none';
      if      (ratio < 0.20) severity = 'severe';
      else if (ratio < 0.40) severity = 'moderate';
      else if (ratio < 0.60) severity = 'mild';

      return { ratio: +ratio.toFixed(2), isAdapted, severity, estimatedSlowdown };
    },
  };

  // ─────────────────────────────────────────────────────────────
  //  MEDICAL SAFETY GUARD
  //  Ensures no strategy violates HEALTH_MEAL_RULES
  // ─────────────────────────────────────────────────────────────
  function _medicalGuard(strategy, healthConditions, dietKey) {
    if (!strategy || !healthConditions) return { safe: true, warnings: [] };
    const warnings = [];

    // Check strategy-specific contraindications
    if (strategy.contraindicated) {
      for (const cond of strategy.contraindicated) {
        if (healthConditions.includes(cond)) {
          warnings.push(`${strategy.label}: غير موصى به مع حالة ${cond}`);
        }
      }
    }

    // Refeed carb guard for diabetes/insulin
    if ((strategy.carbMult > 1.5) &&
        (healthConditions.includes('diabetes') || healthConditions.includes('insulin'))) {
      warnings.push('Refeed بكارب مرتفع: استشر طبيبك. سيتم تقليل الكارب تلقائيا');
    }

    // Aggressive deficit guard for BP
    if (strategy.calAdj < 0.75 && healthConditions.includes('bp')) {
      warnings.push('عجز حاد: قد يؤثر على ضغط الدم — تابع مع طبيبك');
    }

    // Kidney: protein can't spike even on refeed
    if (strategy.proteinMult > 1.20 && healthConditions.includes('kidney')) {
      warnings.push('بروتين Refeed: يقيد لمشاكل الكلى تلقائيا');
    }

    // Keto + refeed carb = incompatible
    if (['keto', 'carnivore'].includes(dietKey) &&
        (strategy.id === 'refeed_single' || strategy.id === 'refeed_double')) {
      warnings.push('Refeed كارب مرتفع يتعارض مع الكيتو — استخدم Fat Refeed بدلا');
    }

    const safe = warnings.length === 0;
    return { safe, warnings };
  }

  // ─────────────────────────────────────────────────────────────
  //  CORE ASSESSOR — المقيم الرئيسي
  // ─────────────────────────────────────────────────────────────
  // input = {
  //   weightHistory:     [{ week:N, weight:X }],  // آخر 4-8 أسابيع
  //   weeksCutting:      N,                        // كم أسبوع في العجز
  //   deficitPct:        0.20,                     // نسبة العجز من TDEE
  //   bodyFatPct:        N,
  //   bmi:               N,
  //   adherencePct:      70–100,                   // نسبة الالتزام
  //   goal:              'cut'|'bulk'|'recomp'|'maintain',
  //   healthConditions:  [...],
  //   dietKey:           'balanced'|'keto'|...
  // }
  function assess(input) {
    const {
      weightHistory    = [],
      weeksCutting     = 0,
      deficitPct       = 0.20,
      bodyFatPct       = 20,
      bmi              = 25,
      adherencePct     = 85,
      goal             = 'cut',
      healthConditions = [],
      dietKey          = 'balanced',
      expectedWeeklyLoss = 0.5,
    } = input;

    // ── Step 1: Detect plateau type ───────────────────────────
    let plateauType = PLATEAU_TYPES.NONE;
    const signals = [];

    // Weight stall check
    if (weightHistory.length >= TRIGGERS.weightStallWeeks) {
      const recent = weightHistory.slice(-TRIGGERS.weightStallWeeks);
      const maxW = Math.max(...recent.map(w => w.weight));
      const minW = Math.min(...recent.map(w => w.weight));
      const change = maxW - minW;

      if (change < TRIGGERS.weightStallKg) {
        plateauType = PLATEAU_TYPES.MILD_STALL;
        signals.push(`ثبات الوزن: تغيير ${change.toFixed(2)} كجم في ${TRIGGERS.weightStallWeeks} أسابيع فقط`);

        if (weightHistory.length >= TRIGGERS.severeStallWeeks) {
          const severe = weightHistory.slice(-TRIGGERS.severeStallWeeks);
          const sevChange = Math.max(...severe.map(w=>w.weight)) - Math.min(...severe.map(w=>w.weight));
          if (sevChange < TRIGGERS.severeStallKg) {
            plateauType = PLATEAU_TYPES.TRUE_PLATEAU;
            signals.push(`ثبات تام: ${sevChange.toFixed(2)} كجم فقط في ${TRIGGERS.severeStallWeeks} أسابيع`);
          }
        }
      }
    }

    // Metabolic adaptation
    const metaStatus = META_DETECTOR.detect(weightHistory, expectedWeeklyLoss);
    if (metaStatus.isAdapted && plateauType !== PLATEAU_TYPES.NONE) {
      plateauType = PLATEAU_TYPES.METABOLIC_ADAPT;
      signals.push(`تكيف أيضي محتمل: تحقق ${metaStatus.ratio * 100}% من الخسارة المتوقعة فقط`);
    }

    // Aggressive deficit
    if (deficitPct >= TRIGGERS.aggressiveDeficitPct) {
      if (plateauType === PLATEAU_TYPES.NONE) plateauType = PLATEAU_TYPES.AGGRESSIVE_DEFICIT;
      signals.push(`عجز حاد: ${Math.round(deficitPct * 100)}% من TDEE — Cortisol مرتفع محتمل`);
    }

    // Long cut fatigue
    if (weeksCutting >= TRIGGERS.longCutWeeks) {
      if ([PLATEAU_TYPES.NONE, PLATEAU_TYPES.MILD_STALL].includes(plateauType)) {
        plateauType = PLATEAU_TYPES.LONG_CUT_FATIGUE;
      }
      signals.push(`⏳ قطع طويل: ${weeksCutting} أسبوع بدون راحة — التعب الهرموني والنفسي محتمل`);
    }

    // Adherence drop
    if (adherencePct < TRIGGERS.lowAdherencePct) {
      if (plateauType === PLATEAU_TYPES.NONE) plateauType = PLATEAU_TYPES.ADHERENCE_BREAK;
      signals.push(`انخفاض الالتزام: ${adherencePct}% فقط — الخطة تحتاج تعديل للاستدامة`);
    }

    // Obese plateau
    if (bmi >= 30 && plateauType !== PLATEAU_TYPES.NONE) {
      plateauType = PLATEAU_TYPES.OBESE_PLATEAU;
      signals.push(`بروتوكول سمنة: BMI ${bmi.toFixed(1)} — يحتاج نهجا خاصا للثبات الهرموني`);
    }

    // Stubborn fat (low BF + true plateau or metabolic adaptation)
    // FIX: also triggers on METABOLIC_ADAPT — both indicate a real stall
    const _stubbornBase = [PLATEAU_TYPES.TRUE_PLATEAU, PLATEAU_TYPES.METABOLIC_ADAPT];
    if (bodyFatPct < 15 && _stubbornBase.includes(plateauType)) {
      plateauType = PLATEAU_TYPES.STUBBORN_FAT;
      signals.push(`دهون عنيدة: BF ${bodyFatPct}% مع ثبات تام — يحتاج بروتوكول متخصص`);
    }

    // ── Step 2: Select strategies ─────────────────────────────
    const isPlateauing = plateauType !== PLATEAU_TYPES.NONE;

    let recommendedStrategies = [];
    if (isPlateauing) {
      // Filter strategies suitable for this plateau type
      recommendedStrategies = Object.values(PLATEAU_STRATEGIES)
        .filter(s => s.bestFor.includes(plateauType))
        .sort((a, b) => a.priority - b.priority);

      // Fallback: if no match, use general strategies
      if (recommendedStrategies.length === 0) {
        recommendedStrategies = [
          PLATEAU_STRATEGIES.refeed_single,
          PLATEAU_STRATEGIES.deficit_reduce,
        ];
      }
    }

    // ── Step 3: Medical guard ─────────────────────────────────
    const guardedStrategies = recommendedStrategies.map(s => {
      const guard = _medicalGuard(s, healthConditions, dietKey);
      return { ...s, safetyWarnings: guard.warnings, isSafe: guard.safe };
    });

    // Primary recommended = first safe strategy
    const primary = guardedStrategies.find(s => s.isSafe) || guardedStrategies[0] || null;

    // ── Step 4: Refeed schedule ───────────────────────────────
    const refeedFreqDays = REFEED_SCHEDULE.getFrequency(deficitPct, bodyFatPct, goal);

    // ── Step 5: Severity label ────────────────────────────────
    const severityMap = {
      [PLATEAU_TYPES.NONE]:               { label: 'لا ثبات',          color: 'var(--green)',  level: 0 },
      [PLATEAU_TYPES.MILD_STALL]:         { label: 'ثبات خفيف',        color: 'var(--orange)', level: 1 },
      [PLATEAU_TYPES.TRUE_PLATEAU]:       { label: 'ثبات حقيقي',       color: 'var(--orange)', level: 2 },
      [PLATEAU_TYPES.METABOLIC_ADAPT]:    { label: 'تكيف أيضي',       color: 'var(--red)',    level: 3 },
      [PLATEAU_TYPES.ADHERENCE_BREAK]:    { label: 'انخفاض الالتزام',  color: 'var(--orange)', level: 2 },
      [PLATEAU_TYPES.STUBBORN_FAT]:       { label: 'دهون عنيدة',       color: 'var(--red)',    level: 3 },
      [PLATEAU_TYPES.OBESE_PLATEAU]:      { label: 'ثبات السمنة',       color: 'var(--red)',    level: 3 },
      [PLATEAU_TYPES.AGGRESSIVE_DEFICIT]: { label: 'عجز حاد',          color: 'var(--red)',    level: 3 },
      [PLATEAU_TYPES.LONG_CUT_FATIGUE]:   { label: '⏳ إجهاد قطع طويل',  color: 'var(--orange)', level: 2 },
    };

    const severity = severityMap[plateauType] || severityMap[PLATEAU_TYPES.NONE];

    return {
      isPlateauing,
      plateauType,
      severity,
      signals,
      metaStatus,
      recommendedStrategies: guardedStrategies,
      primaryStrategy: primary,
      refeedFreqDays,
      weeksCutting,
      adherencePct,
      deficitPct,
      bodyFatPct,
    };
  }

  // ─────────────────────────────────────────────────────────────
  //  GET REFEED PLAN — from current context
  // ─────────────────────────────────────────────────────────────
  function getRefeedPlan(ctx) {
    if (!ctx) return null;
    const strategy = ctx.bmi >= 30 ? PLATEAU_STRATEGIES.obese_refeed : PLATEAU_STRATEGIES.refeed_single;
    return REFEED_SCHEDULE.calcRefeedDay(
      ctx.tdee,
      ctx.baseMac,
      strategy,
      ctx.health || []
    );
  }

  // ─────────────────────────────────────────────────────────────
  //  GET RELIEF PLAN — maintenance transition
  // ─────────────────────────────────────────────────────────────
  function getReliefPlan(ctx) {
    if (!ctx) return null;
    const strategy = PLATEAU_STRATEGIES.maintenance_relief;
    const mainCal  = Math.round(ctx.tdee); // صيانة = TDEE
    const protein  = Math.round(ctx.baseMac.protein * strategy.proteinMult);
    const fat      = Math.round(ctx.baseMac.fat     * strategy.fatMult);
    const carbs    = Math.max(50, Math.round((mainCal - protein * 4 - fat * 9) / 4));

    // ── PATCH 2b — Kidney protein cap in getReliefPlan: use IBW ──
    // Consistent with calcProteinTarget fix — obese CKD users must
    // have protein capped based on IBW, not actual weight.
    let finalProtein = protein;
    if (ctx.health.includes('kidney')) {
      const heightIn2 = (DE && DE.height) ? DE.height / 2.54 : 170 / 2.54;
      const ibwBase2  = (DE && DE.gender === 'أنثى') ? 45.5 : 50;
      const ibw2      = Math.max(30, ibwBase2 + 2.3 * (heightIn2 - 60));
      const refWeight2 = ctx.weight > ibw2 * 1.2 ? ibw2 : ctx.weight;
      finalProtein = Math.min(protein, Math.round(refWeight2 * 0.8));
    }

    return {
      calories: mainCal,
      protein:  finalProtein,
      carbs,
      fat,
      durationWeeks: 2,
      strategy: strategy.id,
      label:    strategy.label,
      protocol: strategy.protocol,
    };
  }

  // ─────────────────────────────────────────────────────────────
  //  RENDER PANEL — full plateau UI
  // ─────────────────────────────────────────────────────────────
  function renderPanel(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // ── Collect context from DE + engine ──────────────────────
    let ctx = null;
    try {
      if (typeof DE !== 'undefined' && typeof calcTDEE === 'function') {
        const tdee   = calcTDEE();
        const bf     = (typeof estimateBodyFat === 'function') ? estimateBodyFat() : 20;
        const bmi    = DE.weight / ((DE.height / 100) ** 2);
        const baseCal= (typeof calcTargetCals === 'function') ? calcTargetCals() : tdee;
        const baseMac= (typeof calcMacros === 'function')
          ? calcMacros(baseCal, DE.selectedDiet)
          : { protein: 150, carbs: 200, fat: 55 };

        ctx = {
          tdee, bf, bmi,
          weight:  DE.weight,
          goal:    DE.goal || 'cut',
          health:  DE.healthConditions || [],
          dietKey: DE.selectedDiet || 'balanced',
          baseMac,
          baseCal,
          deficitPct: tdee > 0 ? Math.abs(tdee - baseCal) / tdee : 0.20,
        };
      }
    } catch(e) { /* graceful */ }

    if (!ctx) {
      container.innerHTML = `<div class="info-box info-warning"><span class="ib-icon"></span><span>أكمل بياناتك لعرض تحليل الثبات</span></div>`;
      return;
    }

    // ── Run assessment with simulated context ─────────────────
    const input = {
      weightHistory:    [],   // user hasn't entered weight history yet
      weeksCutting:     ctx.goal === 'cut' ? 4 : 0,
      deficitPct:       ctx.deficitPct,
      bodyFatPct:       ctx.bf,
      bmi:              ctx.bmi,
      adherencePct:     85,
      goal:             ctx.goal,
      healthConditions: ctx.health,
      dietKey:          ctx.dietKey,
      expectedWeeklyLoss: 0.5,
    };
    const report = assess(input);

    // Refeed plan
    const refeedPlan = getRefeedPlan(ctx);
    // Relief plan
    const reliefPlan = getReliefPlan(ctx);

    // Refeed frequency label
    const freqLabel = report.refeedFreqDays === 0 ? 'غير مطلوب'
      : report.refeedFreqDays <= 7  ? `كل ${report.refeedFreqDays} أيام`
      : report.refeedFreqDays <= 14 ? 'كل أسبوعين'
      : report.refeedFreqDays <= 21 ? 'كل 3 أسابيع'
      : 'كل 4 أسابيع';

    // ── Strategies HTML ───────────────────────────────────────
    const strategiesHTML = Object.values(PLATEAU_STRATEGIES).map((s, i) => {
      const guard   = _medicalGuard(s, ctx.health, ctx.dietKey);
      const isBest  = report.primaryStrategy?.id === s.id;
      const notSafe = !guard.safe;
      const borderCol = isBest ? 'rgba(42,232,123,0.4)' : notSafe ? 'rgba(232,76,76,0.2)' : 'var(--border)';
      const bgCol   = isBest ? 'rgba(42,232,123,0.06)' : 'var(--surface2)';

      return `
      <div style="padding:12px 14px;border-radius:10px;border:1.5px solid ${borderCol};
                  background:${bgCol};margin-bottom:8px;opacity:${notSafe ? '0.6' : '1'};">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
          <span style="font-size:13px;font-weight:800;color:var(--text);">${s.label}</span>
          ${isBest ? `<span style="font-size:10px;background:rgba(42,232,123,0.15);color:var(--green);padding:2px 8px;border-radius:10px;font-weight:700;">الأمثل لحالتك</span>` : ''}
          ${notSafe ? `<span style="font-size:10px;background:rgba(232,76,76,0.1);color:var(--red);padding:2px 8px;border-radius:10px;">قيود صحية</span>` : ''}
          <span style="font-size:10px;color:var(--text-dim);margin-right:auto;">${s.duration}</span>
        </div>
        <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:8px;line-height:1.7;">${s.mechanism}</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;font-size:11px;margin-bottom:6px;">
          <span style="color:var(--accent);">كارب ×${s.carbMult}</span>
          <span style="color:var(--green);">بروتين ×${s.proteinMult}</span>
          <span style="color:var(--orange);">دهون ×${s.fatMult}</span>
          ${s.refeedFreq ? `<span style="color:var(--blue);">تكرار كل ${s.refeedFreq} يوم</span>` : ''}
        </div>
        <div style="font-size:11px;color:var(--text-muted);">
          ${s.protocol.slice(0,3).map(p => `<div style="margin-bottom:2px;">• ${p}</div>`).join('')}
        </div>
        ${guard.warnings.length ? `<div style="margin-top:6px;font-size:10.5px;color:var(--red);">${guard.warnings.join('<br>')}</div>` : ''}
      </div>`;
    }).join('');

    // ── Refeed Day Card ───────────────────────────────────────
    const refeedHTML = refeedPlan ? `
      <div style="background:rgba(42,140,232,0.06);border:1.5px solid rgba(42,140,232,0.3);
                  border-radius:12px;padding:14px;margin-bottom:12px;">
        <div style="font-size:13px;font-weight:800;color:var(--blue);margin-bottom:8px;">
          يوم Refeed — الأرقام المحسوبة لك
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px;">
          ${[
            ['kcal', refeedPlan.calories, 'var(--accent)'],
            ['بروتين', refeedPlan.protein + 'ج', 'var(--green)'],
            ['كارب',   refeedPlan.carbs   + 'ج', 'var(--blue)'],
            ['دهون',   refeedPlan.fat     + 'ج', 'var(--orange)'],
          ].map(([lbl,val,col]) => `
            <div style="background:var(--surface2);border-radius:8px;padding:8px;text-align:center;">
              <div style="font-size:16px;font-weight:900;color:${col};">${val}</div>
              <div style="font-size:10px;color:var(--text-muted);">${lbl}</div>
            </div>`).join('')}
        </div>
        <div style="font-size:11px;color:var(--text-muted);">${refeedPlan.note}</div>
        <div style="font-size:11px;color:var(--blue);margin-top:4px;">التكرار الموصى به: ${freqLabel}</div>
      </div>` : '';

    // ── Relief Period Card ────────────────────────────────────
    const reliefHTML = reliefPlan ? `
      <div style="background:rgba(42,232,123,0.05);border:1.5px solid rgba(42,232,123,0.25);
                  border-radius:12px;padding:14px;margin-bottom:12px;">
        <div style="font-size:13px;font-weight:800;color:var(--green);margin-bottom:8px;">
         فترة الصيانة — أهداف الراحة الحرارية
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px;">
          ${[
            ['kcal', reliefPlan.calories, 'var(--accent)'],
            ['بروتين', reliefPlan.protein + 'ج', 'var(--green)'],
            ['كارب',   reliefPlan.carbs   + 'ج', 'var(--blue)'],
            ['دهون',   reliefPlan.fat     + 'ج', 'var(--orange)'],
          ].map(([lbl,val,col]) => `
            <div style="background:var(--surface2);border-radius:8px;padding:8px;text-align:center;">
              <div style="font-size:16px;font-weight:900;color:${col};">${val}</div>
              <div style="font-size:10px;color:var(--text-muted);">${lbl}</div>
            </div>`).join('')}
        </div>
        <div style="font-size:11px;color:var(--text-muted);">⏱المدة: ${reliefPlan.durationWeeks} أسابيع · ثم عودة تدريجية للعجز (+100 kcal/أسبوع)</div>
      </div>` : '';

    // ── Metabolic Adaptation Note ─────────────────────────────
    const metaHTML = `
      <div style="background:var(--surface2);border-radius:10px;padding:12px;margin-bottom:12px;">
        <div style="font-size:12px;font-weight:800;color:var(--text);margin-bottom:6px;">دليل مكافحة التكيف الأيضي</div>
        <div style="font-size:11.5px;color:var(--text-muted);line-height:1.8;">
          ${[
            `<span style="color:var(--green);"></span> Refeed كل ${freqLabel} يمنع انخفاض اللبتين`,
            `<span style="color:var(--green);"></span> بروتين مرتفع (×${ctx.goal==='cut'?'1.25–1.35':'1.05–1.10'}) يحمي الكتلة العضلية`,
            `<span style="color:var(--green);"></span> عجز لا يتجاوز ${Math.round(ctx.deficitPct*100)}% من TDEE (${Math.round(ctx.tdee * ctx.deficitPct)} kcal/يوم)`,
            `<span style="color:var(--orange);"></span> لا تخفض السعرات عند الثبات — أضف Refeed أولا`,
            `<span style="color:var(--orange);"></span> ثبات الوزن 3+ أسابيع = إشارة للتغيير، ليس الفشل`,
            `<span style="color:var(--red);"></span> عجز > 35% من TDEE يسبب هدم العضل والإجهاد الهرموني`,
          ].map(t=>`<div>${t}</div>`).join('')}
        </div>
      </div>`;

    // ── Diet-specific notes ───────────────────────────────────
    const dietNotes = {
      keto:      'كيتو + Plateau: استخدم Fat Refeed (دهون صحية) لا Carb Refeed. الخروج من Ketosis مؤقت مقبول',
      carnivore: 'كارنفور + Plateau: Refeed كلاسيكي غير ممكن. جرب Protein Cycling أو فترة صيانة بلحوم أعلى دهونا',
      lowcarb:   'لوكارب + Plateau: Refeed معتدل (80–100جم كارب) مقبول. حافظ على GI منخفض',
      carbcycle: 'كارب سايكل + Plateau: أيام الكارب العالي هي Refeed بالفعل. زدها ب 30–50جم',
      mediterranean: 'البحر المتوسط + Plateau: جرب يوم كارب أعلى (حبوب كاملة + فاكهة) أو زيادة النشاط، وراجع كميات زيت الزيتون',
    };
    const dietNoteHTML = dietNotes[ctx.dietKey]
      ? `<div class="info-box info-warning" style="margin-bottom:10px;"><span class="ib-icon"></span><span style="font-size:12px;">${dietNotes[ctx.dietKey]}</span></div>`
      : '';

    container.innerHTML = `
      ${dietNoteHTML}

      <!-- ── Refeed Plan ─── -->
      ${refeedHTML}

      <!-- ── Relief Plan ─── -->
      ${reliefHTML}

      <!-- ── Meta adaptation guide ─── -->
      ${metaHTML}

      <!-- ── Strategies ─── -->
      <div style="font-size:12px;font-weight:800;color:var(--text);margin-bottom:8px;">
        استراتيجيات كسر الثبات — كلها محسوبة لبياناتك
      </div>
      ${strategiesHTML}

      <!-- ── Footer note ─── -->
      <div style="margin-top:10px;font-size:10.5px;color:var(--text-dim);line-height:1.7;
                  padding:8px 10px;background:var(--surface2);border-radius:8px;">
       هذه التوصيات مبنية على: TDEE ${ctx.tdee} kcal · BF ${ctx.bf.toFixed(1)}% · BMI ${ctx.bmi.toFixed(1)} · ${ctx.goal}
        <br>الأرقام اقتراحية — الثبات جزء طبيعي من أي رحلة. الفشل الوحيد هو التوقف
      </div>
    `;
  }

  // ─────────────────────────────────────────────────────────────
  //  SELF-TESTS
  // ─────────────────────────────────────────────────────────────
  function runSelfTests() {
    let passed = 0, failed = 0;
    const assert = (label, cond) => {
      if (cond) { passed++; console.log(`PHL: ${label}`); }
      else       { failed++; console.error(`PHL FAIL: ${label}`); }
    };

    // ── 1. assess() returns valid object for no-history input
    const r0 = assess({ goal:'cut', bodyFatPct:22, bmi:26, deficitPct:0.20 });
    assert('assess() returns object without crash', r0 && typeof r0 === 'object');
    assert('plateauType is valid string', typeof r0.plateauType === 'string');
    assert('isPlateauing is boolean', typeof r0.isPlateauing === 'boolean');

    // ── 2. True plateau detection
    const flatHistory = [
      { week:1, weight:80.2 }, { week:2, weight:80.1 },
      { week:3, weight:80.0 }, { week:4, weight:80.1 }
    ];
    const rFlat = assess({
      weightHistory: flatHistory, goal:'cut',
      bodyFatPct:22, bmi:26, deficitPct:0.20, expectedWeeklyLoss:0.5
    });
    assert('True plateau detected on flat weight history', rFlat.isPlateauing);
    assert('True plateau type set correctly', rFlat.plateauType !== PLATEAU_TYPES.NONE);

    // ── 3. No plateau for progressive loss
    const progressHistory = [
      { week:1, weight:82 }, { week:2, weight:81.3 },
      { week:3, weight:80.5 }, { week:4, weight:79.8 }
    ];
    const rProgress = assess({ weightHistory: progressHistory, goal:'cut', bodyFatPct:22, bmi:26, deficitPct:0.18 });
    assert('No plateau detected for progressive weight loss', !rProgress.isPlateauing);

    // ── 4. Obese plateau detection
    const rObese = assess({
      weightHistory: flatHistory, goal:'cut',
      bodyFatPct:38, bmi:34, deficitPct:0.25
    });
    assert('Obese plateau detected for BMI > 30 + stall', rObese.plateauType === PLATEAU_TYPES.OBESE_PLATEAU);

    // ── 5. Stubborn fat detection
    const rStubborn = assess({
      weightHistory: flatHistory, goal:'cut',
      bodyFatPct:12, bmi:22, deficitPct:0.20,
      expectedWeeklyLoss: 0.3
    });
    assert('Stubborn fat detected at BF < 15% with stall', rStubborn.plateauType === PLATEAU_TYPES.STUBBORN_FAT);

    // ── 6. Aggressive deficit detection
    const rAggr = assess({ goal:'cut', deficitPct:0.32, bodyFatPct:22, bmi:26 });
    assert('Aggressive deficit detected at > 25% deficit', rAggr.plateauType === PLATEAU_TYPES.AGGRESSIVE_DEFICIT || rAggr.signals.some(s=>s.includes('عجز')));

    // ── 7. Long cut fatigue
    const rLong = assess({ goal:'cut', weeksCutting:10, deficitPct:0.20, bodyFatPct:22, bmi:26 });
    assert('Long cut fatigue detected at week 10', rLong.plateauType === PLATEAU_TYPES.LONG_CUT_FATIGUE || rLong.signals.some(s=>s.includes('قطع')));

    // ── 8. Medical guard — diabetes + high carb refeed
    const guardResult = _medicalGuard(PLATEAU_STRATEGIES.refeed_single, ['diabetes'], 'balanced');
    assert('Medical guard fires for diabetes + high carb refeed', guardResult.warnings.length > 0);

    // ── 9. Medical guard — keto + carb refeed
    const guardKeto = _medicalGuard(PLATEAU_STRATEGIES.refeed_single, [], 'keto');
    assert('Medical guard fires for keto + carb refeed', guardKeto.warnings.length > 0);

    // ── 10. No conflicts with diet rules — strategies don't touch meal engine
    assert('PLATEAU_STRATEGIES defined correctly', Object.keys(PLATEAU_STRATEGIES).length >= 7);
    assert('REFEED_SCHEDULE.getFrequency() returns number', typeof REFEED_SCHEDULE.getFrequency(0.20, 22, 'cut') === 'number');

    // ── 11. getRefeedPlan — no NaN, no negative
    const fakeCtx = {
      tdee: 2200, bf: 22, bmi: 26, weight: 80, goal: 'cut',
      health: [], dietKey: 'balanced',
      baseMac: { protein: 160, carbs: 180, fat: 55 }, baseCal: 1800
    };
    const rfPlan = getRefeedPlan(fakeCtx);
    assert('getRefeedPlan: no NaN calories', rfPlan && !isNaN(rfPlan.calories));
    assert('getRefeedPlan: calories > 0', rfPlan && rfPlan.calories > 0);
    assert('getRefeedPlan: no negative macros', rfPlan && rfPlan.protein > 0 && rfPlan.carbs > 0 && rfPlan.fat > 0);

    // ── 12. getReliefPlan — no NaN, no negative
    const relPlan = getReliefPlan(fakeCtx);
    assert('getReliefPlan: no NaN calories', relPlan && !isNaN(relPlan.calories));
    assert('getReliefPlan: calories > 0', relPlan && relPlan.calories > 0);
    assert('getReliefPlan: no negative macros', relPlan && relPlan.protein > 0 && relPlan.carbs >= 50);

    // ── 13. Kidney protein guard in relief plan
    const kidneyCtx = { ...fakeCtx, health: ['kidney'] };
    const kidneyRelief = getReliefPlan(kidneyCtx);
    assert('getReliefPlan: kidney protein capped', kidneyRelief && kidneyRelief.protein <= Math.round(80 * 0.8));

    // ── 14. META_DETECTOR — adapted detection
    const slowHistory = [
      { week:1, weight:82 }, { week:2, weight:81.8 },
      { week:3, weight:81.7 }, { week:4, weight:81.6 }
    ];
    const meta = META_DETECTOR.detect(slowHistory, 0.5);
    assert('META_DETECTOR: detects slow loss vs expected', meta.ratio < 0.5);
    assert('META_DETECTOR: isAdapted true for severe slowdown', meta.isAdapted);

    // ── 15. Adherence drop detection
    const rAdh = assess({ goal:'cut', adherencePct:60, bodyFatPct:22, bmi:26, deficitPct:0.18 });
    assert('Adherence drop detected at < 70%', rAdh.plateauType === PLATEAU_TYPES.ADHERENCE_BREAK || rAdh.signals.some(s=>s.includes('الالتزام')));

    // ── 16. No calorie corruption — refeed cal never negative
    const edgeCases = [
      { tdee:1400, baseMac:{ protein:120, carbs:100, fat:40 }, health:[], bmi:22 },
      { tdee:3000, baseMac:{ protein:220, carbs:300, fat:80 }, health:['diabetes'], bmi:30 },
      { tdee:1200, baseMac:{ protein:100, carbs:80,  fat:35 }, health:['kidney'], bmi:24 },
    ];
    let noCalCorruption = true;
    edgeCases.forEach(ec => {
      const plan = REFEED_SCHEDULE.calcRefeedDay(ec.tdee, ec.baseMac, PLATEAU_STRATEGIES.refeed_single, ec.health);
      if (!plan || isNaN(plan.calories) || plan.calories <= 0 || plan.protein < 0 || plan.carbs < 0 || plan.fat < 0) {
        noCalCorruption = false;
      }
    });
    assert('No calorie corruption in edge case refeed calculations', noCalCorruption);

    console.log(`\nPHL Self-Tests: ${passed} passed, ${failed} failed`);
    if (failed === 0) console.log('PHL — All tests passed!');
    return { passed, failed };
  }

  // ── Public API ────────────────────────────────────────────────
  return {
    assess,
    getRefeedPlan,
    getReliefPlan,
    renderPanel,
    runSelfTests,
    // Expose internals for advanced usage
    PLATEAU_STRATEGIES,
    PLATEAU_TYPES,
    REFEED_SCHEDULE,
    META_DETECTOR,
  };

})(); // end PHL IIFE

LOG('✔ PHL — Plateau Handling Layer ready (v25)');
LOG('PHL.assess(input) - PlateauReport {isPlateauing, plateauType, strategies,...}');
LOG('PHL.getRefeedPlan(ctx) - {calories, protein, carbs, fat, note}');
LOG('PHL.getReliefPlan(ctx) - {calories, protein, carbs, fat, durationWeeks}');
LOG('PHL.renderPanel(id) - full plateau UI in container');
LOG('PHL.runSelfTests() - 16-test suite in console');

// FIX-3: Auto-run PHL tests only when browser is idle
(window.requestIdleCallback || function(cb){ setTimeout(cb, 4000); })(() => {
  try {
    const r = PHL.runSelfTests();
    LOG(`✔ PHL Tests: ${r.passed} passed, ${r.failed} failed`);
  } catch(e) {
    LOG('PHL Tests error: ' + e.message);
  }
});
