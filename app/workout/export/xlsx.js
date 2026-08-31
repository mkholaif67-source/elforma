// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// XLSX EXPORT — export/xlsx.js
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function exportTrackerXLSX(){
  try{
    if(typeof XLSX==='undefined'){ alert('جاري تحميل مكتبة Excel، حاول مجددا بعد ثانية'); return; }
    const plan = state.plan||[];
    const splits = getSplits();
    const splitName = splits[state.selectedSplit]?.name||'غير محدد';
    const goalLabels={cut:'تنشيف',muscle:'ضخامة',strength:'قوة',fitness:'لياقة'};
    const wb = XLSX.utils.book_new();

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // SHEET 1: DASHBOARD (Main Single Page)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const rows = [];
    const addRow = (...cells) => rows.push(cells);
    const blank = () => rows.push(['']);

    // ── HEADER BANNER
    addRow('  SMART WORKOUT DESIGNER — FITNESS DASHBOARD', '', '', '', '', '', '', '', '');
    addRow(splitName + '  |  ' + goalLabels[state.goal] + '  |  ' + state.days + ' أيام/أسبوع', '', '', '', '', '', '', '', '');
    blank();

    // ── KPI CARDS ROW
    addRow(' KPI — مؤشرات الأداء الرئيسية', '', '', '', '', '', '', '', '');
    addRow('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '', '', '', '', '', '', '', '');
    addRow('الوزن الحالي', state.weight+' كجم', '', 'TDEE اليومي', state.tdee+' kcal', '', 'هدف السعرات', (state.goal==='cut'?state.tdee-400:state.goal==='muscle'?state.tdee+250:state.tdee)+' kcal', '');
    addRow('Recovery Score', state.recoveryScore+'%', '', 'BMI', (state.bmi||0).toFixed(1), '', 'بروتين يومي', Math.round(state.weight*1.8)+'g', '');
    addRow('أيام التدريب', state.days+'/أسبوع', '', 'وقت الجلسة', state.time+' دقيقة', '', 'الخبرة', {beginner:'مبتدئ',intermediate:'متوسط',advanced:'متقدم'}[state.exp]||'-', '');
    addRow('Fatigue Capacity', (state.fatigueCap||80)+'%', '', 'Training Tolerance', (state.trainingTolerance||75)+'%', '', 'Volume Capacity', (state.weeklyVolCap||80)+'%', '');
    blank();

    // ── INJURY AWARENESS
    if(!state.injuries.includes('none') && state.injuries.length > 0){
      addRow(' تحذيرات الإصابات — تجنب هذه التمارين أو خففها', '', '', '', '', '', '', '', '');
      const injMsgs={shoulder:'كتف: تجنب الضغط فوق الرأس',back:'ظهر: تجنب Deadlift وGood Morning',knee:'ركبة: تجنب السكوات العميق',elbow:'مرفق: قلل وزن تمارين الذراع',wrist:'رسغ: استخدم straps وتجنب Wrist Curl',neck:'رقبة: تجنب Shrugs والضغط على الرقبة'};
      state.injuries.forEach(inj=>{ addRow(' '+( injMsgs[inj]||inj), '', '', '', '', '', '', '', ''); });
      blank();
    }

    // ── EACH DAY TRAINING LOG
    plan.forEach((day, idx)=>{
      const exs = day.exercises||[];
      const dayColors = ['#4c44cc','#00a470','#2b62c6','#7835d7','#cc5500','#b4a000'];

      addRow(` يوم ${idx+1} — ${day.name}`, '', '', '', '', '', '', '', '');

      // يوم الراحة = راحة 100% — لا إحماء ولا تمارين ولا استرتش
      if (day.isRest) {
        addRow(' يوم راحة كامل — لا يوجد أي نشاط بدني اليوم', '', '', '', '', '', '', '', '');
        addRow('النوم الكافي والتغذية الجيدة هما كل ما تحتاجه اليوم ', '', '', '', '', '', '', '', '');
        blank();
        blank();
        return;
      }

      addRow('العضلات: '+( day.muscles||[]).join(' · '), '', '', '', '', '', '', '', '');
      addRow(' إحماء: '+(day.warm||[]).slice(0,3).join('  •  '), '', '', '', '', '', '', '', '');
      addRow('');
      addRow('التمرين', 'العضلة المستهدفة', 'Tier', 'المجموعات', 'العدات', 'الراحة', 'RIR', 'التقدم', 'الوزن المستخدم (kg)', 'RPE (1-10)', 'ملاحظات', 'مكتمل ', 'البديل', 'رابط الفيديو');

      exs.forEach((ex, ei)=>{
        const vidUrl = safeVidUrl(ex.vid, ex.grp);
        rows.push([
          ex.n + (ex.blocked?'  تعديل إصابة':''),
          ex.mu||'',
          ex.tier+'-Tier',
          ex.sets,
          ex.reps,
          fmtRest(ex.rest),
          ex.rir||'',
          ex.progression||'',
          '', // weight input
          '', // RPE input
          '', // notes input
          '', // done checkbox
          ex.alt,
          {t:'s', v:vidUrl, l:{Target:vidUrl}}
        ]);
      });

      addRow(' استرتش: '+(day.stretch||[]).slice(0,3).join('  •  '), '', '', '', '', '', '', '', '');
      addRow(' تقييم اليوم (تعبئة تلقائية حسب الالتزام):', '', '=IF(COUNTIF(J'+( rows.length)+':"Excellent")', '', '', '', '', '', '');
      blank();
      blank();
    });

    // ── WEEKLY WEIGHT TRACKER
    addRow(' متابعة الوزن والمقاسات الأسبوعية', '', '', '', '', '', '', '', '');
    addRow('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '', '', '', '', '', '', '', '');
    addRow('الأسبوع', 'الوزن (kg)', 'الخصر (cm)', 'الصدر (cm)', 'الذراع (cm)', 'الأرجل (cm)', 'نسبة الدهون (%)', 'تغير الوزن', 'ملاحظات');
    addRow('البداية', state.weight, '', '', '', '', '', '—', 'Baseline');
    for(let w=1;w<=12;w++){
      rows.push(['الأسبوع '+w, '', '', '', '', '', '', w>1?'=B'+(rows.length)+'-B'+(rows.length-1):'', '']);
    }
    blank();

    // ── STRENGTH TRACKER
    addRow(' متابعة مؤشرات القوة', '', '', '', '', '', '', '', '');
    addRow('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '', '', '', '', '', '', '', '');
    addRow('الأسبوع', 'Bench Press (kg)', 'Back Squat (kg)', 'Deadlift (kg)', 'OHP (kg)', 'Row (kg)', 'تحسن Bench', 'ملاحظات');
    for(let w=1;w<=12;w++){
      rows.push(['الأسبوع '+w, '', '', '', '', '', w>1?'=B'+(rows.length)+'-B'+(rows.length-1):'', '']);
    }
    blank();

    // ── RECOVERY DAILY TRACKER
    addRow(' متابعة التعافي اليومي', '', '', '', '', '', '', '', '');
    addRow('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '', '', '', '', '', '', '', '');
    addRow('التاريخ', 'ساعات النوم', 'ماء (لتر)', 'التوتر (1-10)', 'الطاقة (1-10)', 'آلام العضلات (1-10)', 'Recovery Score', 'ملاحظات');
    addRow('تعليمات:', 'الهدف: 8h', 'الهدف: 3-4L', 'الهدف: <5', 'الهدف: >7', 'الهدف: <5', 'تلقائي (متوسط)', '');
    for(let d=1;d<=42;d++){
      rows.push(['اليوم '+d, '', '', '', '', '', '=IF(AND(B'+(rows.length+1)+'>0,D'+(rows.length+1)+'>0),ROUND((B'+(rows.length+1)+'/8*25)+(10-D'+(rows.length+1)+')*5+(E'+(rows.length+1)+'*10)+(10-F'+(rows.length+1)+')*5,0),"—")', '']);
    }
    blank();

    // ── TIPS & GUIDELINES
    addRow(' قواعد الذهب للتقدم', '', '', '', '', '', '', '', '');
    addRow('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '', '', '', '', '', '', '', '');
    const tips = [
      ['1', 'Progressive Overload', 'أضف '+(state.goal==='strength'?'2.5-5':'1-2.5')+' كجم عند إتمام جميع العدات بشكل مثالي'],
      ['2', 'Deload Week', 'كل 4-6 أسابيع خفف الحجم 50% لأسبوع كامل — نفس الحركات'],
      ['3', 'البروتين', Math.round(state.weight*1.8)+'g يوميا في 4 وجبات على الأقل'],
      ['4', 'النوم', '8 ساعات ثابتة — ماغنيسيوم قبل النوم لتحسين الجودة'],
      ['5', 'الترطيب', '3-4 لتر ماء + كهارل في أيام التمرين الشديدة'],
      ['6', 'RPE Target', 'استهدف RPE 7-8. لا تتجاوز RPE 9 باستمرار'],
      ['7', 'التسجيل', 'سجل الوزن والعدات في كل جلسة — What gets measured gets managed'],
      ['8', 'المراجعة', 'راجع التقدم كل أسبوع وعدل الخطة كل 6 أسابيع'],
    ];
    tips.forEach(t=>addRow(t[0], t[1], t[2], '', '', '', '', '', ''));
    blank();

    // Build sheet
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Column widths
    ws['!cols'] = [
      {wch:32},{wch:20},{wch:18},{wch:16},{wch:16},{wch:16},
      {wch:20},{wch:14},{wch:30},{wch:12},{wch:30},{wch:45}
    ];

    // Freeze top 3 rows
    ws['!freeze'] = {xSplit:0, ySplit:3};

    XLSX.utils.book_append_sheet(wb, ws, ' Fitness Dashboard');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // SHEET 2: PROGRAM REFERENCE
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const refRows=[
      [' مرجع البرنامج التدريبي الكامل — '+splitName,'','','','','',''],
      ['اليوم','الجلسة','التمرين','المجموعات × العدات','الراحة','البديل','رابط الفيديو (YouTube Shorts)'],
    ];
    plan.forEach((day,di)=>{
      (day.exercises||[]).forEach((ex,ei)=>{
        const vidUrl = safeVidUrl(ex.vid, ex.grp);
        refRows.push([
          'يوم '+(di+1),
          day.name.split('—')[0].trim(),
          ex.n+(ex.blocked?' ':''),
          ex.sets+'×'+ex.reps,
          fmtRest(ex.rest),
          ex.alt,
          {t:'s', v:vidUrl, l:{Target:vidUrl}}
        ]);
      });
      if(di<plan.length-1) refRows.push(['','','','','','','']);
    });
    const wsRef = XLSX.utils.aoa_to_sheet(refRows);
    wsRef['!cols']=[{wch:10},{wch:28},{wch:36},{wch:16},{wch:18},{wch:32},{wch:50}];
    wsRef['!freeze']={xSplit:0,ySplit:2};
    XLSX.utils.book_append_sheet(wb, wsRef, ' Program Ref');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // SHEET 3: NUTRITION GUIDE
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const nutrRows=[
      [' دليل التغذية المخصص','','',''],
      [''],
      ['المؤشر','القيمة','الهدف','ملاحظات'],
      ['TDEE',state.tdee+' kcal','-','صيانة الوزن الحالي'],
      ['هدف السعرات',(state.goal==='cut'?state.tdee-400:state.goal==='muscle'?state.tdee+250:state.tdee)+' kcal','-',state.goal==='cut'?'عجز 400 kcal للتنشيف':state.goal==='muscle'?'فائض 250 kcal للضخامة':'كالوري الصيانة'],
      ['البروتين',Math.round(state.weight*1.8)+'g','1.6-2g/kg','موزع على 4+ وجبات'],
      ['الكارب',Math.round(state.weight*(state.goal==='cut'?2:4))+'g','-','معظمه قبل وبعد التمرين'],
      ['الدهون',Math.round((state.goal==='cut'?state.tdee-400:state.goal==='muscle'?state.tdee+250:state.tdee)*0.25/9)+'g','25-30% من السعرات','دهون صحية فقط'],
      ['الماء','3-4 لتر/يوم','-','أكثر في أيام التمرين الشديد'],
      [''],
      ['توزيع الوجبات','','',''],
      ['الوجبة','التوقيت','المحتوى','ملاحظات'],
      ['قبل التمرين','1-2 ساعة','كارب معقد + بروتين خفيف','تجنب الدهون المرتفعة'],
      ['بعد التمرين','30-60 دقيقة','بروتين سريع + كارب بسيط','أهم وجبة للتعافي'],
      ['قبل النوم','30 دقيقة','كازين أو جبن قريش','بروتين بطيء الامتصاص'],
    ];
    const wsNutr = XLSX.utils.aoa_to_sheet(nutrRows);
    wsNutr['!cols']=[{wch:22},{wch:22},{wch:22},{wch:36}];
    XLSX.utils.book_append_sheet(wb, wsNutr, ' Nutrition');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // SHEET 4: SMART MODULES
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const activeModules = state.activeModules || [];
    if(activeModules.length > 0){
      const modRows = [];
      const addMR = (...cells) => modRows.push(cells);
      const blankM = () => modRows.push(['']);
      const modNameArX = {cardio:'الكارديو',core:'الكور',kegel:'الكيجل',yoga:'اليوغا',
        mobility:'Mobility & Flex',stretching:'الاسترتش',breathing:'التنفس',
        sleep:'التعافي',weakpoint:'نقاط الضعف',deload:'Deload',nutrition:'التغذية'};

      addMR(' الوحدات التدريبية الذكية المختارة', '', '', '', '', '');
      addMR('تم تفعيل '+activeModules.length+' وحدة مخصصة بناء على هدفك وتعافيك', '', '', '', '', '');
      blankM();

      // Map module category to VID_SAFE_FALLBACKS key for correct fallback
      const modCatToGrp = {
        pelvic_floor:'kegel', cardio_liss:'cardio', cardio_hiit:'cardio', cardio_steady:'cardio',
        core_weighted:'core', core_bodyweight:'core', core_isometric:'core',
        core_anti_rotation:'core', core_rotation:'core', core_stability:'core',
        mobility_hip:'mobility', mobility_spine:'mobility', mobility_shoulder:'mobility',
        mobility_ankle:'mobility', mobility_full:'mobility',
        stretch_static:'stretching',
        yoga_flow:'yoga', yoga_restorative:'yoga', yoga_active:'yoga',
        yoga_standing:'yoga', yoga_balance:'yoga',
        breathwork:'breathing', mindset:'breathing',
        recovery_active:'recovery', recovery_mobility:'recovery',
        recovery_stretch:'recovery', recovery_smr:'recovery',
        recovery_breathing:'recovery', recovery_thermal:'recovery'
      };

      activeModules.forEach(modId => {
        const db = MODULE_DB[modId];
        if(!db) return;
        const exs = Array.isArray(db) ? db : (db.s||[]).concat(db.a||[]).concat(db.b||[]);
        addMR('━━ '+( modNameArX[modId]||modId), '', '', '', '', '', '');
        addMR('التمرين','Tier','التوقيت / المجموعات','الوصف','المعدات','الفئة','▶ رابط الفيديو');
        exs.slice(0,6).forEach(ex => {
          // Resolve video URL using same safeVidUrl pipeline as the UI
          const rawCat = ex.category || ex.grp || modId || 'default';
          const grpKey = modCatToGrp[rawCat] || modId || 'default';
          const vidUrl = safeVidUrl(ex.vid, grpKey);
          modRows.push([
            ex.n, ex.tier+'-Tier',
            ex.duration||ex.sets||ex.protocol||'—',
            ex.desc||'', ex.equipment||'—', ex.category||'—',
            {t:'s', v:vidUrl, l:{Target:vidUrl}}
          ]);
        });
        blankM();
      });

      const wsMod = XLSX.utils.aoa_to_sheet(modRows);
      wsMod['!cols'] = [{wch:34},{wch:10},{wch:28},{wch:50},{wch:14},{wch:20},{wch:50}];
      XLSX.utils.book_append_sheet(wb, wsMod, ' Smart Modules');
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // SHEET 5: MESOCYCLE LONG-TERM PLAN
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
      const expX = state.exp;
      const recX = state.recoveryScore || 70;
      let totalWeeksX;
      if(expX==='beginner') totalWeeksX=8;
      else if(expX==='advanced') totalWeeksX=12;
      else totalWeeksX = recX>=75 ? 10 : 8;
      const goalArX = {cut:'تنشيف',muscle:'ضخامة',strength:'قوة',fitness:'لياقة'}[state.goal]||state.goal;
      const expArX  = {beginner:'مبتدئ',intermediate:'متوسط',advanced:'متقدم'}[expX]||expX;

      const mesoData = [
        // [phase#, name, weeks, load, rir, vol%, deload, instruction]
        [1,'التكيف والأساس','1–2','60–70%','3–4 RIR','100%','لا',
         'نفذ برنامجك بشكل طبيعي. ركز على الشكل الصحيح. لا تتجاوز RPE 7.'],
        [2,'الحمل التدريجي','3–5','70–80%','2–3 RIR','110%','لا',
         `أضف ${state.goal==='strength'?'2.5–5':'1–2.5'} كجم أسبوعيا. سجل كل جلسة.`],
        totalWeeksX>=10
          ? [3,'Deload متوسطي','6','55–65%','4 RIR','60%',' نعم','تخفيف منتصفي — يمنع تراكم الإجهاد']
          : [3,'التكثيف','6–7','80–87%','1–2 RIR','115%','لا','ادفع بثقة. الأسبوع الأخير: أعلى شدة'],
        totalWeeksX>=10
          ? [4,'التكثيف','7–9','80–88%','1–2 RIR','115%','لا','استمر بزيادة الأوزان أسبوعيا.']
          : [4,'Deload — التعافي',totalWeeksX===8?'8':'10','50–60%','4–5 RIR','50%',' نعم','نفس التمارين — نصف الوزن ونصف المجموعات'],
        ...(totalWeeksX>=12 ? [
          [5,'التخصص والذروة','10–11','82–90%','1 RIR','115%','لا','ذروة الأداء. تخصص على نقاط الضعف'],
          [6,'Deload الختامي','12','50–60%','4–5 RIR','50%',' نعم','نهاية الدورة. ابدأ دورة جديدة بمستوى أعلى']
        ] : totalWeeksX===10 ? [
          [5,'Deload الختامي','10','50–60%','4–5 RIR','50%',' نعم','إتمام الدورة. تعاف كامل']
        ] : [])
      ].filter(Boolean);

      const mesoRows = [];
      const addMesoR = (...cells) => mesoRows.push(cells);
      addMesoR(' خطة الدورة التدريبية الطويلة — Mesocycle', '', '', '', '', '', '', '');
      addMesoR(expArX+' · '+goalArX+' · '+totalWeeksX+' أسابيع · Recovery '+recX+'%', '', '', '', '', '', '', '');
      mesoRows.push(['']);
      addMesoR('مرحلة','اسم المرحلة','الأسابيع','الحمل النسبي','هامش RIR','الحجم النسبي','Deload؟','التعليمات');
      mesoData.forEach(row => addMesoR(...row));
      mesoRows.push(['']);
      addMesoR(' بعد إتمام الدورة: ابدأ دورة جديدة برفع الهدف — زد الأوزان أو غير السبليت', '', '', '', '', '', '', '');

      const wsMeso = XLSX.utils.aoa_to_sheet(mesoRows);
      wsMeso['!cols'] = [{wch:8},{wch:22},{wch:12},{wch:14},{wch:12},{wch:12},{wch:10},{wch:55}];
      wsMeso['!freeze'] = {xSplit:0, ySplit:4};
      XLSX.utils.book_append_sheet(wb, wsMeso, ' Mesocycle');
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // SHEET 6: SUPPLEMENTS GUIDE
    // يظهر فقط إذا كانت وحدة المكملات مفعلة
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if((state.activeModules||[]).includes('supplements')){
      const goal = state.goal || 'fitness';
      const goalLabelX = {cut:'تنشيف',muscle:'ضخامة',strength:'قوة',fitness:'لياقة'}[goal]||goal;
      const suppRows = [];
      const addSR = (...cells) => suppRows.push(cells);

      addSR(' دليل المكملات الغذائية — '+goalLabelX,'','','','');
      addSR('المكمل','الجرعة اليومية','التوقيت الأمثل','الفائدة الرئيسية','ملاحظة مهمة');
      suppRows.push(['']);

      addSR('── المكملات الأساسية (لكل الأهداف) ──','','','','');
      const baseSuppsX = SUPP_DB.base.filter(s=>s.goals.includes(goal));
      baseSuppsX.forEach(s => addSR(s.name, s.dose, s.timing, s.benefit, s.note));
      suppRows.push(['']);

      const goalSuppsX = SUPP_DB.byGoal[goal]||[];
      if(goalSuppsX.length){
        addSR('── مكملات هدف '+goalLabelX+' تحديدا ──','','','','');
        goalSuppsX.forEach(s => addSR(s.name, s.dose, s.timing, s.benefit, s.note));
        suppRows.push(['']);
      }

      addSR(' تفاعلات مهمة','','','','');
      addSR('لا تأخذ الزنك مع الكالسيوم في نفس الوقت (فرق ساعتين على الأقل)','','','','');
      addSR('الكرياتين والأشواجندا يحتاجان أسبوعين+ لتظهر نتائجهما الكاملة','','','','');
      addSR('شرب 3-4 لتر ماء يوميا ضروري مع الكرياتين والبروتين','','','','');
      suppRows.push(['']);
      addSR(' هذا الدليل استرشادي — راجع طبيبك قبل البدء بأي مكمل جديد','','','','');

      const wsSupp = XLSX.utils.aoa_to_sheet(suppRows);
      wsSupp['!cols'] = [{wch:30},{wch:22},{wch:32},{wch:55},{wch:55}];
      wsSupp['!freeze'] = {xSplit:0, ySplit:2};
      XLSX.utils.book_append_sheet(wb, wsSupp, ' Supplements');
    }

    // Save
    const fileName = 'لوحة_متابعة_'+splitName.replace(/[\s/+]+/g,'_')+'_'+new Date().toISOString().slice(0,10)+'.xlsx';
    XLSX.writeFile(wb, fileName);

  }catch(e){
    console.error('XLSX Error:',e);
    alert('حدث خطأ في توليد ملف Excel: '+e.message);
  }
}



function downloadBlob(content,filename,type){
  try{
    const blob=new Blob([content],{type});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download=filename;
    document.body.appendChild(a);a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }catch(e){alert('حدث خطأ في التحميل. يرجى المحاولة مجددا.');}
}

function resetAll(){
  const m=document.getElementById('resetModal');
  m.style.display='flex';
}
function confirmReset(){location.reload();}
function cancelReset(){document.getElementById('resetModal').style.display='none';}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROTOCOL ACCORDION — toggles warmup / stretch, mutual exclusive
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function toggleProtocol(which){
  const ids = {
    warmup:  { body:'warmupBody',  icon:'warmupToggleIcon',  txt:'warmupToggleTxt'  },
    stretch: { body:'stretchBody', icon:'stretchToggleIcon', txt:'stretchToggleTxt' }
  };
  const other = which==='warmup' ? 'stretch' : 'warmup';

  const cur   = ids[which];
  const oth   = ids[other];

  const curBody = document.getElementById(cur.body);
  const curIcon = document.getElementById(cur.icon);
  const curTxt  = document.getElementById(cur.txt);
  if(!curBody) return;

  const isOpen = curBody.classList.contains('open');

  // Close the other one first
  const othBody = document.getElementById(oth.body);
  const othIcon = document.getElementById(oth.icon);
  const othTxt  = document.getElementById(oth.txt);
  if(othBody && othBody.classList.contains('open')){
    othBody.classList.remove('open');
    if(othIcon) othIcon.classList.remove('open');
    if(othTxt)  othTxt.textContent = 'اعرض';
  }

  // Toggle current
  if(isOpen){
    curBody.classList.remove('open');
    curIcon.classList.remove('open');
    curTxt.textContent = 'اعرض';
  } else {
    curBody.classList.add('open');
    curIcon.classList.add('open');
    curTxt.textContent = 'أخف';
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DASHBOARD ACCORDION — توصيات التقدم + Mesocycle (independent)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function toggleDashSection(which){
  const map = {
    progressRecs:   { body:'progressRecsBody',   icon:'progressRecsToggleIcon',   txt:'progressRecsTxt'   },
    mesocyclePlan:  { body:'mesocyclePlanBody',   icon:'mesocyclePlanToggleIcon',  txt:'mesocyclePlanTxt'  },
    suppPlan:       { body:'suppPlanBody',         icon:'suppPlanToggleIcon',        txt:'suppPlanTxt'       }
  };
  // suppPlan يعمل مستقلا — لا يغلق الباقين
  // progressRecs و mesocyclePlan يغلق كل منهما الآخر فقط
  const mutualGroup = { progressRecs:'mesocyclePlan', mesocyclePlan:'progressRecs' };
  const other = mutualGroup[which] || null;

  const cur = map[which];
  if(!cur) return;

  const curBody = document.getElementById(cur.body);
  const curIcon = document.getElementById(cur.icon);
  const curTxt  = document.getElementById(cur.txt);
  if(!curBody) return;

  const isOpen = curBody.classList.contains('open');

  // Close the mutual-pair other (if any)
  if(other){
    const oth = map[other];
    const othBody = document.getElementById(oth.body);
    const othIcon = document.getElementById(oth.icon);
    const othTxt  = document.getElementById(oth.txt);
    if(othBody && othBody.classList.contains('open')){
      othBody.classList.remove('open');
      if(othIcon) othIcon.classList.remove('open');
      if(othTxt)  othTxt.textContent = 'اعرض';
    }
  }

  // Toggle current
  if(isOpen){
    curBody.classList.remove('open');
    curIcon.classList.remove('open');
    curTxt.textContent = 'اعرض';
  } else {
    curBody.classList.add('open');
    curIcon.classList.add('open');
    curTxt.textContent = 'أخف';
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STEP 0 — GOAL SELECTOR SCREEN
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let _goalScreenVal = null;

function selectGoalCard(val, el) {
  _goalScreenVal = val;
  // Remove selected from all cards
  document.querySelectorAll('.goal-card-item').forEach(c => c.classList.remove('gs-selected'));
  // Add to clicked
  el.classList.add('gs-selected');
  // Hide error
  document.getElementById('gsError').style.display = 'none';
}

function goFromGoalStep() {
  if (!_goalScreenVal) {
    document.getElementById('gsError').style.display = 'block';
    return;
  }
  // Store goal from sec1 selection into state
  state.goal = _goalScreenVal;
  // Navigate to step 2 (profile form)
  showSection(2);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LOCAL STORAGE — حفظ واسترجاع بيانات المستخدم
// إضافة بحتة — لا تعديل في أي منطق موجود
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const STORAGE_KEY = 'smartWorkout_state_v18';
// الحقول الأساسية فقط — بدون computed values (هتتحسب تاني)
const STATE_FIELDS_TO_SAVE = [
  'age','height','weight','gender','exp','days','time',
  'goal','equip','sleep','stress','daily','injuries','weak'
];

