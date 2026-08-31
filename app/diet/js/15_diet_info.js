// ══════════════════════════════════════════════════════════════════
//  DIET INFO SECTION — AI-powered (isolated, no side effects)
// ══════════════════════════════════════════════════════════════════
const DI = {
  expanded: false,
  currentDietKey: null,
  loadedFor: null,   // tracks which dietKey was last loaded
};

const DI_DIET_LABELS = {
  balanced:  'متوازن',
  lowcarb:   'لو كارب',
  mediterranean: 'حمية البحر المتوسط',
  carbcycle: 'كارب سايكل',
  keto:      'كيتو',
  carnivore: 'كارنفور',
};

const DI_DIET_NAMES_EN = {
  balanced:  'Balanced diet',
  lowcarb:   'Low-carb diet',
  mediterranean: 'Mediterranean diet',
  carbcycle: 'Carb cycling diet',
  keto:      'Ketogenic diet',
  carnivore: 'Carnivore diet',
};

// Called by selectDiet() after a diet is chosen — show the section
function diOnDietSelected(dietKey) {
  DI.currentDietKey = dietKey;
  const sec = document.getElementById('diet-info-section');
  if (!sec) return;
  sec.style.display = 'block';
  // Update badge label
  const badge = document.getElementById('diet-info-diet-badge');
  if (badge) badge.textContent = DI_DIET_LABELS[dietKey] || dietKey;
  // Update subtitle
  const sub = document.getElementById('diet-info-subtitle');
  if (sub) sub.textContent = 'اضغط لعرض معلومات مفيدة ومختصرة عن هذا النظام';
  // If already expanded - force-reload for new diet
  if (DI.expanded) {
    DI.loadedFor = null;
    loadDietInfo(true);
  }
}

// Toggle expand/collapse
function toggleDietInfoExpand() {
  DI.expanded = !DI.expanded;
  const body    = document.getElementById('diet-info-body');
  const chevron = document.getElementById('diet-info-chevron');
  if (body)    body.style.display      = DI.expanded ? 'block' : 'none';
  if (chevron) chevron.style.transform = DI.expanded ? 'rotate(180deg)' : 'rotate(0deg)';
  if (!DI.expanded) return;
  // No diet selected yet
  if (!DI.currentDietKey) {
    const c = document.getElementById('diet-info-content');
    const l = document.getElementById('diet-info-loading');
    const e = document.getElementById('diet-info-error');
    if (l) l.style.display = 'none';
    if (e) e.style.display = 'none';
    if (c) { c.style.display = 'block'; c.innerHTML = '<div style="text-align:center;padding:16px 0;font-size:12px;color:var(--text-muted);">اختر نظاما أولا من البطاقات أعلاه لعرض معلوماته</div>'; }
    return;
  }
  loadDietInfo(true);
}

// Fetch info for the selected diet — static, no external calls
const DI_STATIC_DATA = {
  balanced: {
    summary: "نظام متوازن يوزع السعرات على البروتين والكارب والدهون بنسب صحية معتمدة، مرن وسهل الالتزام طويل المدى، ومناسب لأغلب الأهداف والأعمار",
    how_it_works: "يعتمد على توزيع السعرات بنسبة تقريبية 30% بروتين، 40% كارب معقد، 30% دهون صحية. لا يقيد مجموعة غذائية كاملة، مما يحسن الأيض ويبقي مستوى الطاقة مستقرا طوال اليوم",
    best_for: ["من يريد الحفاظ على الوزن أو التضخيم", "المبتدئين في رحلة التغذية", "من يأكل خارج المنزل كثيرا", "الرياضيين في مرحلة الصيانة"],
    avoid_if: ["من يريد تنشيفا سريعا جدا", "من لديه مقاومة إنسولين حادة"],
    pros: ["مرن وسهل التطبيق في البيئة العربية", "لا يسبب نقص في أي عنصر غذائي", "مناسب اجتماعيا وعائليا", "يدعم الطاقة والأداء الرياضي"],
    cons: ["النتائج أبطأ مقارنة بالكيتو أو لو كارب", "يحتاج تتبعا دقيقا للكميات"],
    daily_tip: "ابدأ بتقليل الكارب المكرر (خبز أبيض، أرز أبيض) واستبدله بالبدائل المعقدة كالشوفان والأرز البني، مع الحفاظ على بروتين في كل وجبة",
    common_myth: "الخرافة: 'الدايت المتوازن يعني آكل من كل حاجة بحرية' — الحقيقة: المتوازن يعني نسب صحيحة ومحسوبة، وليس بلا ضوابط"
  },
  mediterranean: {
    summary: "حمية البحر المتوسط نظام متوازن قائم على الأطعمة الكاملة: زيت الزيتون كمصدر دهون أساسي، خضار وفاكهة يوميا، بقوليات وحبوب كاملة، سمك 2-3 مرات أسبوعيا، ولحوم حمراء قليلة. من أكثر الأنظمة دعما بالأدلة العلمية لصحة القلب والشرايين وطول العمر",
    how_it_works: "يعتمد على دهون أحادية غير مشبعة (زيت الزيتون) وأوميغا-3 (الأسماك) بدل الدهون المشبعة، مع كارب معقد منخفض إلى متوسط ال GI من الحبوب الكاملة والبقوليات، وكمية كبيرة من الألياف ومضادات الأكسدة. هذا المزيج يقلل الالتهاب، يحسن حساسية الإنسولين، ويخفض الكوليسترول الضار LDL والثلاثية",
    best_for: ["مرضى ضغط الدم والكوليسترول", "الكبد الدهني ومتلازمة التمثيل الغذائي", "السكري ومقاومة الإنسولين (نسخة محسوبة الكارب)", "من يريد نظاما صحيا مستداما مدى الحياة"],
    avoid_if: ["من يريد تنشيفا سريعا جدا خلال أسابيع قليلة", "من لديه حساسية شديدة من البقوليات/الجلوتين (يحتاج تعديل)"],
    pros: ["أقوى الأنظمة دليلا علميا لصحة القلب وطول العمر", "سهل الالتزام ولذيذ ومناسب اجتماعيا", "يخفض الكوليسترول والالتهاب ويحسن السكر", "غني بالألياف ومضادات الأكسدة وأوميغا-3"],
    cons: ["النتائج في خسارة الوزن أبطأ من لو كارب/الكيتو", "يحتاج زيت زيتون جيد وسمك منتظم (تكلفة أعلى قليلا)"],
    daily_tip: "اجعل زيت الزيتون دهنك الأساسي، أضف طبق سلطة وخضار لكل وجبة رئيسية، تناول سمكا مشويا 2-3 مرات أسبوعيا، وقلل اللحوم المصنعة والحلويات والمقليات",
    common_myth: "الخرافة: 'حمية البحر المتوسط تعني أكل مكرونة وخبز كتير' — الحقيقة: أساسها الخضار والبقوليات والسمك وزيت الزيتون، والحبوب تكون كاملة ومحسوبة وليست مكررة"
  },
  lowcarb: {
    summary: "نظام لو كارب يعتمد على تقليل الكربوهيدرات بشكل كبير (عادة أقل من 100-150 غرام يوميا) مع رفع نسبة البروتين والدهون الصحية، يجبر الجسم على حرق الدهون كمصدر رئيسي للطاقة بدلا من الجلوكوز",
    how_it_works: "عند تقليل الكربوهيدرات، تنخفض مستويات الأنسولين في الدم مما يحفز الجسم على تكسير الدهون المخزنة للحصول على الطاقة. في الحالات الأكثر تقييدا يدخل الجسم حالة الكيتوزيس حيث ينتج أجساما كيتونية كوقود بديل. هذا يساعد في التحكم في الشهية وتثبيت مستوى السكر في الدم",
    best_for: ["من يريد خسارة الدهون مع الحفاظ على الكتلة العضلية", "الرياضيون في رياضات التحمل بعد مرحلة التكيف الدهني", "مرضى السكري من النوع الثاني أو مقاومة الأنسولين"],
    avoid_if: ["رياضيو القوة والسباحة الذين يحتاجون كربوهيدرات سريعة للأداء", "الحوامل والمرضعات إلا بإشراف طبي متخصص"],
    pros: ["خسارة فعالة للدهون خاصة في منطقة البطن", "تحسين حساسية الأنسولين", "تقليل الشهية وتثبيت مستوى الطاقة طوال اليوم بسبب ارتفاع البروتين والدهون"],
    cons: ["قد يقلل الأداء الرياضي في التمارين الانفجارية قصيرة المدة خلال أسابيع التكيف الأولى", "صعوبة الالتزام الاجتماعي والتطبيقي على المدى الطويل في البيئة العربية"],
    daily_tip: "ابدأ بإزالة الخبز والأرز والسكر فقط في الأسبوع الأول، وركز على البيض واللحوم والخضروات الورقية والمكسرات حتى يتكيف جسمك تدريجيا",
    common_myth: "الخرافة: لو كارب يضر بالكلى ويرفع الكوليسترول — الحقيقة: الدراسات تظهر أنه آمن للكلى السليمة ويرفع الكوليسترول الجيد HDL بينما يخفض الثلاثية في معظم الحالات"
  },
  carbcycle: {
    summary: "نظام ذكي يتناوب بين أيام كارب عالي وأيام كارب منخفض بناء على جدول التمرين، يحافظ على الأيض نشطا ويوفر الوقود المناسب في الوقت المناسب",
    how_it_works: "في أيام التمرين الشديد يرتفع الكارب (150-250ج) لملء الجليكوجين العضلي ودعم الأداء، وفي أيام الراحة ينخفض الكارب (50-80ج) لزيادة حرق الدهون. هذا التناوب يمنع تكيف الجسم مع عجز السعرات ويحمي الكتلة العضلية أثناء التنشيف",
    best_for: ["الرياضيون الذين يتدربون 3-5 أيام أسبوعيا", "من وصل ل Plateau ويريد كسره", "هدف ال Recomp (بناء عضل وحرق دهون معا)", "من يشعر بالملل من الدايت الثابت"],
    avoid_if: ["المبتدئين تماما في تتبع الأكل", "من لا يملك جدول تمرين منتظم"],
    pros: ["يكسر ثبات الوزن بفاعلية", "يبقي الأيض مرتفعا ويمنع التكيف", "مرونة عالية وتنوع يومي", "يدعم بناء العضل وحرق الدهون بالتزامن"],
    cons: ["يحتاج تخطيطا وتتبعا دقيقا يوميا", "معقد نسبيا للمبتدئين"],
    daily_tip: "في يوم التمرين: أضف وجبة كارب قبل التمرين بساعة (موز + شوفان). في يوم الراحة: احذف الكارب من العشاء واستبدله ببروتين ودهون صحية",
    common_myth: "الخرافة: كارب سايكل معناه آكل فطيرة وعيش كل يوم تمرين — الحقيقة: الكارب العالي يعني كارب معقد ونظيف كالأرز والبطاطا والشوفان، وليس أي كارب"
  },
  keto: {
    summary: "نظام كيتوجيني صارم يقلل الكارب لأقل من 50 جرام يوميا ويرفع الدهون ل 65-75% من السعرات، يدخل الجسم في حالة Ketosis لحرق الدهون مباشرة كوقود أساسي",
    how_it_works: "عند انعدام الجلوكوز من الكارب، يحول الكبد الدهون إلى أجسام كيتونية تصبح الوقود الأساسي للدماغ والعضلات. تحقيق Ketosis يستغرق 2-7 أيام ويتطلب الحفاظ على كارب أقل من 50ج صافي يوميا بشكل مستمر",
    best_for: ["من يريد حرق دهون سريع وقوي", "مرضى الصرع (فاعلية طبية مثبتة)", "مرضى السكري النوع الثاني بإشراف طبي", "من يعاني من التهابات مزمنة أو ضباب ذهني"],
    avoid_if: ["من يريد التضخيم أو بناء عضل بسرعة", "رياضيو القوة والانفجار (CrossFit، رفع أثقال)", "من لديه مشاكل في الكبد أو البنكرياس"],
    pros: ["حرق دهون قوي وسريع خاصة في البداية", "طاقة ذهنية مستقرة بعد التكيف", "تقليل الشهية بشكل ملحوظ", "تحسين مستويات السكر والإنسولين"],
    cons: ["Keto Flu في الأسابيع الأولى (صداع، إرهاق، دوخة)", "صعب جدا اجتماعيا في البيئة العربية", "يحتاج تتبعا دقيقا جدا للكارب الصافي"],
    daily_tip: "في الأسبوع الأول أكثر من الصوديوم والبوتاسيوم والمغنيسيوم (مرق عظام، أفوكادو، مكسرات) لتجنب Keto Flu وتشنجات العضلات",
    common_myth: "الخرافة: الكيتو يضر بالقلب بسبب الدهون العالية — الحقيقة: الدراسات تظهر أن الكيتو يرفع HDL الجيد ويخفض الثلاثية، لكن نوع الدهون مهم (دهون صحية وليس مشبعة مصنعة)"
  },
  carnivore: {
    summary: "نظام اللحوم فقط: بروتين ودهون حيوانية بالكامل مع كارب قريب من الصفر. نظام صارم جدا يعتمد على اللحوم والبيض والأسماك والدهون الحيوانية فقط",
    how_it_works: "يزيل جميع الأطعمة النباتية ويعتمد كليا على البروتين الحيواني والدهون. الجسم يدخل في حالة كيتوزيس عميقة، ويعتمد على الجلوكوز المنتج من البروتين (Gluconeogenesis) لتغذية الأنسجة التي تحتاجه. يدعى أنه يقلل الالتهابات المرتبطة ببعض الأطعمة النباتية",
    best_for: ["من يعاني من أمراض مناعية ذاتية ويريد تجربة إزالة المحفزات", "حالات متقدمة من فرط الحساسية الغذائية تحت إشراف طبي", "من جرب كل الأنظمة ولم يجد نتيجة"],
    avoid_if: ["من لديه مشاكل في الكلى أو ارتفاع الكرياتينين", "من لديه كوليسترول مرتفع غير مسيطر عليه", "الحوامل والمرضعات والأطفال والمراهقين", "من يريد التضخيم أو بناء عضل بشكل رئيسي"],
    pros: ["تبسيط كامل للتغذية بدون تتبع معقد", "تقليل الالتهابات عند بعض الأشخاص", "شبع قوي جدا بسبب البروتين العالي"],
    cons: ["نقص واضح في الألياف وفيتامين C والمغذيات النباتية", "صعب جدا اجتماعيا وتطبيقيا", "أدلة علمية محدودة على المدى الطويل", "غير مناسب للتضخيم وبناء العضل بكفاءة"],
    daily_tip: "إذا قررت تجربته، ابدأ ب 30 يوم فقط كتجربة وراقب جسمك جيدا. أكثر من اللحم المفروم والبيض والسمك الدهني، وتجنب اللحوم المصنعة",
    common_myth: "الخرافة: البشر خلقوا ليأكلوا اللحوم فقط وهو النظام الطبيعي — الحقيقة: الأدلة الأنثروبولوجية تظهر أن أسلافنا كانوا آكلي كل شيء Omnivores، والكارنفور نظام حديث وليس أصيلا"
  }
};

function loadDietInfo(forceRefresh) {
  if (!DI.currentDietKey) return;

  const contentEl  = document.getElementById('diet-info-content');
  const refreshRow = document.getElementById('diet-info-refresh-row');
  const errorDiv   = document.getElementById('diet-info-error');
  const loadingEl  = document.getElementById('diet-info-loading');

  if (loadingEl) loadingEl.style.display = 'none';
  if (errorDiv)  errorDiv.style.display  = 'none';
  if (!contentEl) return;

  const info = DI_STATIC_DATA[DI.currentDietKey];
  if (!info) {
    contentEl.style.display = 'block';
    contentEl.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:12px;">لا توجد بيانات لهذا النظام</div>';
    return;
  }

  const dietNameAr = DI_DIET_LABELS[DI.currentDietKey] || DI.currentDietKey;
  try {
    contentEl.innerHTML = diRenderInfo(info, dietNameAr);
  } catch(err) {
    contentEl.innerHTML = '<div style="padding:12px;color:var(--red);font-size:12px;">خطأ في عرض البيانات</div>';
  }
  contentEl.style.display = 'block';
  DI.loadedFor = DI.currentDietKey;
  if (refreshRow) refreshRow.style.display = 'none';
}

function diRenderInfo(info, label) {
  const safe = t => (t || '').toString().replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const tagList = (arr, cls) =>
    (arr || []).map(i => `<span class="di-tag ${cls || ''}">${safe(i)}</span>`).join('');

  return `
    <div class="di-block">
      <div class="di-block-title">ما هو نظام ${safe(label)}؟</div>
      <div class="di-block-body">${safe(info.summary)}</div>
    </div>
    <div class="di-block">
      <div class="di-block-title">كيف يعمل؟</div>
      <div class="di-block-body">${safe(info.how_it_works)}</div>
    </div>
    <div class="di-block">
      <div class="di-block-title">الأنسب ل</div>
      <div style="margin-top:4px;">${tagList(info.best_for, 'green')}</div>
    </div>
    <div class="di-block" style="margin-top:10px;">
      <div class="di-block-title">المميزات</div>
      <div style="margin-top:4px;">${tagList(info.pros, 'blue')}</div>
    </div>
    <div class="di-block" style="margin-top:10px;">
      <div class="di-block-title">العيوب</div>
      <div style="margin-top:4px;">${tagList(info.cons, 'orange')}</div>
    </div>
    <div class="di-block" style="margin-top:10px;">
      <div class="di-block-title">تجنبه إذا</div>
      <div style="margin-top:4px;">${tagList(info.avoid_if, 'red')}</div>
    </div>
    <div class="di-block" style="margin-top:12px;">
      <div class="di-block-title">نصيحة اليوم</div>
      <div class="di-block-body" style="border-color:rgba(42,232,123,0.25);background:rgba(42,232,123,0.05);color:var(--text);">${safe(info.daily_tip)}</div>
    </div>
    <div class="di-block">
      <div class="di-block-title">خرافة شائعة</div>
      <div class="di-block-body" style="border-color:rgba(245,166,35,0.25);background:rgba(245,166,35,0.04);color:var(--text);">${safe(info.common_myth)}</div>
    </div>
  `;
}
// ══ END DIET INFO SECTION ══
