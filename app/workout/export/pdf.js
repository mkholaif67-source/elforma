// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PDF EXPORT — export/pdf.js
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function buildPDFHTML(plan, splitName, goalTxt){
  // ElForma branding (user name + auto domain)
  const _userName = (typeof window!=='undefined' && window.FORMA_USER && window.FORMA_USER.name) ? String(window.FORMA_USER.name).trim().split(/\s+/)[0] : '';
  const siteName = 'ElForma';
  const siteDomain = (typeof location!=='undefined' && location.host) ? location.host.replace(/^www\./,'') : 'elforma.app';
  const helloLine = _userName ? ('أهلا يا <b style="color:#fff">' + _userName + '</b>') : 'أهلا بيك في رحلة التحول';
  const splits = getSplits();
  const goalLabels={cut:'تنشيف',muscle:'ضخامة',strength:'قوة',fitness:'لياقة'};
  const dayColorHex=['#0097B2','#00D4AA','#22B8CF','#5B8BDB','#FF6B35','#FF9266'];
  const injMsgs={
    shoulder:' إصابة كتف: تجنب الضغط فوق الرأس - استخدم الكابل',
    back:' إصابة ظهر: تجنب الديدليفت - فضل Chest Supported Row Machine',
    knee:' إصابة ركبة: تجنب السكوات العميق - فضل Leg Extension',
    elbow:' إصابة مرفق: قلل الوزن في تمارين الذراع',
    wrist:' إصابة رسغ: استخدم straps وتجنب Wrist Curl المباشر',
    neck:' إصابة رقبة: تجنب Shrugs والتمارين الضاغطة على الرقبة'
  };

  let html = `<!DOCTYPE html><html lang="ar" dir="rtl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
html{-webkit-text-size-adjust:100%;}
body{font-family:'Cairo',Tahoma,sans-serif;background:#07080f;color:#e8eaff;direction:rtl;font-size:14px;line-height:1.7;width:100%;max-width:100%;margin:0 auto;padding:0 12px;overflow-x:hidden;}
.page{width:100%;max-width:100%;background:#07080f;padding:22px 0 32px;page-break-after:always;overflow-x:hidden;}
.cover-shell{position:relative;overflow:hidden;border-radius:24px;padding:28px 24px 26px;margin-bottom:24px;background:linear-gradient(135deg,#080e22 0%,#0a0620 45%,#160828 100%);border:1px solid rgba(0,212,170,0.2);box-shadow:0 32px 64px -24px rgba(0,212,170,0.22),inset 0 0 0 1px rgba(255,255,255,0.04);}
.cover-glow{position:absolute;border-radius:50%;filter:blur(90px);opacity:0.5;pointer-events:none;z-index:0;}
.glow-a{width:300px;height:300px;background:#33E0BC;top:-120px;right:-60px;}
.glow-b{width:280px;height:280px;background:#00D4AA;bottom:-140px;left:-60px;opacity:0.35;}
.brand-row{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:18px;flex-wrap:wrap;}
.brand-mark{display:flex;align-items:center;gap:13px;}
.brand-logo-wrap{width:50px;height:50px;flex-shrink:0;}
.brand-logo-wrap img{width:50px;height:50px;object-fit:contain;border-radius:13px;box-shadow:0 10px 28px -8px rgba(0,212,170,0.5);}
.brand-logo-fb{width:50px;height:50px;border-radius:13px;background:linear-gradient(135deg,#00D4AA,#33E0BC);display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:900;color:#04210a;box-shadow:0 10px 28px -8px rgba(0,212,170,0.5);flex-shrink:0;}
.brand-text{display:flex;flex-direction:column;line-height:1.2;text-align:right;}
.brand-name{font-size:20px;font-weight:900;color:#fff;letter-spacing:-0.5px;background:linear-gradient(135deg,#fff 40%,#00D4AA 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.brand-name-ar{font-size:12px;font-weight:700;color:#7ec8e3;margin-top:1px;letter-spacing:0.5px;}
.brand-domain{font-size:10px;color:#7fa8c8;font-weight:600;margin-top:2px;direction:ltr;}
.cover-badge{position:relative;z-index:2;font-size:9.5px;font-weight:900;letter-spacing:1.5px;color:#04210f;background:linear-gradient(135deg,#00D4AA,#33E0BC);padding:7px 16px;border-radius:30px;box-shadow:0 6px 20px -6px rgba(0,212,170,0.55);display:inline-block;}
.cover-divider{position:relative;z-index:2;height:1px;background:linear-gradient(90deg,transparent,rgba(0,212,170,0.25),rgba(0,212,170,0.2),transparent);margin:0 0 20px;}
.cover-hello{position:relative;z-index:2;font-size:13px;color:#a8d8ff;font-weight:700;margin-bottom:6px;}
.cover-title{position:relative;z-index:2;font-size:clamp(26px,5vw,38px);font-weight:900;background:linear-gradient(135deg,#fff 0%,#00D4AA 50%,#33E0BC 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:10px;line-height:1.25;}
.cover-sub{position:relative;z-index:2;font-size:13px;color:#b0bcd8;margin-bottom:16px;font-weight:600;}
.cover-meta{position:relative;z-index:2;display:flex;flex-wrap:wrap;gap:7px;}
.meta-pill{font-size:10.5px;font-weight:700;color:#eef0f7;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.11);padding:5px 13px;border-radius:30px;}
.meta-pill.accent{background:linear-gradient(135deg,rgba(0,212,170,0.15),rgba(0,212,170,0.12));border-color:rgba(0,212,170,0.35);color:#cffaff;}
.week-strip{display:flex;gap:6px;margin-bottom:22px;flex-wrap:wrap;background:#0d1020;border-radius:14px;padding:12px 14px;border:1px solid rgba(255,255,255,0.06);}
.week-day-chip{flex:1;min-width:66px;border-radius:10px;padding:9px 6px;text-align:center;}
.wdc-num{font-size:11px;font-weight:900;margin-bottom:2px;}
.wdc-type{font-size:9px;font-weight:700;opacity:0.8;margin-bottom:2px;}
.wdc-icon{font-size:18px;margin-bottom:2px;}
.stats-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:22px;}
.stats-row-2{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:22px;margin-top:-12px;}
.stat-card{background:linear-gradient(135deg,#0f1422,#111828);border:1px solid #1e2540;border-radius:13px;padding:14px 12px;text-align:center;position:relative;overflow:hidden;}
.stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#00D4AA,#33E0BC);opacity:0.5;}
.stat-val{font-size:19px;font-weight:900;color:#00D4AA;margin-bottom:4px;line-height:1;}
.stat-lbl{font-size:11px;color:#8898aa;font-weight:700;letter-spacing:.3px;margin-top:2px;}
.injury-box{background:rgba(255,68,102,0.07);border:1px solid rgba(255,68,102,0.28);border-radius:11px;padding:11px 15px;margin-bottom:15px;color:#fca5b5;font-size:11px;}
.weak-box{background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.22);border-radius:11px;padding:11px 15px;margin-bottom:15px;color:#93c5fd;font-size:11px;}
.day-section{margin-bottom:24px;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.07);box-shadow:0 8px 32px -12px rgba(0,0,0,0.6);}
.day-header{padding:16px 18px;position:relative;overflow:hidden;}
.day-header-content{position:relative;z-index:2;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;}
.day-header-left{display:flex;align-items:center;gap:14px;flex:1;}
.day-num-wrap{display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0;}
.day-num{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:900;color:#fff;}
.day-num-label{font-size:8px;font-weight:800;opacity:0.65;letter-spacing:0.5px;}
.day-info{flex:1;}
.day-type-label{font-size:10px;font-weight:800;letter-spacing:1px;opacity:0.75;margin-bottom:3px;}
.day-name{font-size:15px;font-weight:900;color:#fff;line-height:1.2;margin-bottom:5px;}
.day-muscles-row{display:flex;flex-wrap:wrap;gap:5px;margin-top:4px;}
.muscle-chip{font-size:9.5px;font-weight:700;padding:3px 9px;border-radius:20px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.75);}
.day-right{display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;}
.day-icon{font-size:26px;line-height:1;}
.day-badge{font-size:10px;font-weight:800;padding:4px 13px;border-radius:20px;border:1px solid;white-space:nowrap;}
.warmup-strip{background:rgba(251,191,36,0.07);border-bottom:1px solid rgba(251,191,36,0.15);padding:10px 18px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.warmup-label{font-size:10px;font-weight:900;color:#fbbf24;flex-shrink:0;}
.warmup-tag{font-size:10px;background:rgba(251,191,36,0.1);color:#fde68a;border:1px solid rgba(251,191,36,0.2);padding:3px 10px;border-radius:8px;margin:1px;}
.ex-table{width:100%;border-collapse:separate;border-spacing:0;}
.ex-table th{font-size:10px;font-weight:800;padding:10px 12px;text-align:right;border-bottom:1px solid rgba(255,255,255,0.06);color:#4a5570;letter-spacing:0.3px;background:rgba(0,0,0,0.2);}
.ex-table td{font-size:11.5px;padding:12px 12px;border-bottom:1px solid rgba(255,255,255,0.04);vertical-align:middle;line-height:1.5;}
.ex-table tbody tr:nth-child(even) td{background:rgba(255,255,255,0.02);}
.ex-table tbody tr:last-child td{border-bottom:none;}
.ex-num-circle{width:26px;height:26px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#fff;}
.ex-name-main{font-size:12.5px;font-weight:800;color:#ecedff;unicode-bidi:isolate;direction:rtl;line-height:1.4;}
.ex-name-mu{font-size:10px;color:#7878a8;margin-top:3px;font-weight:600;}
.tier-s{background:linear-gradient(135deg,rgba(251,191,36,0.2),rgba(245,158,11,0.1));color:#fbbf24;border:1px solid rgba(251,191,36,0.3);font-size:9px;font-weight:900;padding:2px 9px;border-radius:8px;display:inline-block;}
.tier-a{background:linear-gradient(135deg,rgba(59,130,246,0.18),rgba(37,99,235,0.1));color:#60a5fa;border:1px solid rgba(59,130,246,0.3);font-size:9px;font-weight:900;padding:2px 9px;border-radius:8px;display:inline-block;}
.sets-badge{background:linear-gradient(135deg,#1a1a35,#161630);border:1px solid rgba(139,131,255,0.3);color:#8b83ff;font-size:11.5px;font-weight:800;padding:4px 12px;border-radius:9px;white-space:nowrap;display:inline-block;}
.rest-badge{background:rgba(0,212,170,0.07);border:1px solid rgba(0,212,170,0.22);color:#00D4AA;font-size:10px;padding:4px 10px;border-radius:9px;white-space:nowrap;display:inline-block;}
.alt-txt{font-size:10px;color:#5a5a80;line-height:1.4;}
.vid-link{display:flex;align-items:center;justify-content:center;gap:5px;background:rgba(255,0,60,0.12);border:1px solid rgba(255,0,60,0.3);color:#ff4466;font-size:11px;font-weight:800;padding:7px 10px;border-radius:10px;text-decoration:none;white-space:normal;word-break:keep-all;width:100%;text-align:center;}
.inj-warn-row td{background:rgba(255,68,102,0.05)!important;color:#fca5b5;font-size:10px;}
.stretch-strip{background:rgba(0,212,170,0.05);border-top:1px solid rgba(0,212,170,0.12);padding:10px 18px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.stretch-label{font-size:10px;font-weight:900;color:#00D4AA;flex-shrink:0;}
.stretch-tag{font-size:10px;background:rgba(0,212,170,0.07);color:#a0f5d8;border:1px solid rgba(0,212,170,0.15);padding:3px 10px;border-radius:8px;margin:1px;unicode-bidi:isolate;direction:rtl;}
.rest-day-content{padding:20px 22px;display:flex;align-items:center;gap:14px;}
.rest-day-icon{font-size:32px;}
.rest-day-title{font-size:14px;font-weight:800;color:#6080a8;margin-bottom:4px;}
.rest-day-sub{font-size:11px;color:#404060;line-height:1.6;}
.recovery-page{margin-top:20px;}
.recovery-title{font-size:20px;font-weight:900;color:#00D4AA;margin-bottom:18px;display:flex;align-items:center;gap:10px;}
.rec-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.rec-card{background:#111420;border:1px solid #1e2540;border-radius:13px;padding:16px;}
.rec-card-title{font-size:13px;font-weight:800;color:#8b83ff;margin-bottom:8px;display:flex;align-items:center;gap:7px;}
.rec-card-body{font-size:11px;color:#7878a8;line-height:1.9;}
.rec-card-val{font-size:22px;font-weight:900;color:#00D4AA;margin-top:6px;}
.footer-bar{margin-top:28px;padding:14px 0 8px;border-top:1px solid #141830;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#55557a;flex-wrap:wrap;gap:8px;}
.footer-brand{font-weight:800;color:#6080a8;}
.footer-lock{font-size:9px;background:rgba(0,212,170,0.06);border:1px solid rgba(0,212,170,0.15);color:#00D4AA;padding:3px 10px;border-radius:20px;}
.page-break{page-break-before:always;padding-top:28px;}
@media(max-width:600px){
  body{font-size:13px;padding:0 8px;}
  .cover-shell{padding:20px 16px 18px;border-radius:18px;}
  .brand-logo-wrap,.brand-logo-wrap img{width:40px;height:40px;}
  .brand-name{font-size:17px;}
  .cover-badge{font-size:8px;padding:6px 10px;letter-spacing:1px;}
  .cover-title{font-size:22px;}
  .cover-sub,.cover-hello{font-size:12px;}
  .meta-pill{font-size:9px;padding:4px 9px;}
  .stats-row{grid-template-columns:1fr 1fr;gap:8px;}
  .stat-val{font-size:15px;}
  .ex-table{table-layout:fixed;}
  .ex-table th,.ex-table td{padding:6px 5px;font-size:11px;}
  .ex-table .col-alt,.ex-table .col-tier{display:none;}
  .ex-table .col-sets{width:75px;}
  .ex-table .col-rest{width:70px;}
  .ex-table .col-vid{width:68px;}
  .ex-table .col-num{width:26px;}
  .ex-name-main{font-size:11px;}
  .ex-name-mu{font-size:9px;}
  .ex-alt-mobile{display:block!important;}
  .sets-badge,.rest-badge{font-size:10px;padding:2px 6px;}
  .rec-grid{grid-template-columns:1fr;}
  .day-header{padding:12px 14px;}
  .day-icon{font-size:20px;}
  .vid-link{padding:6px 4px;font-size:10px;}
  .week-strip{gap:4px;padding:10px;}
  .week-day-chip{min-width:48px;padding:7px 4px;}
}
@media print{
  body{background:#07080f!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;max-width:none;}
  .page{page-break-after:always;}
  .vid-link{color:#ff4466!important;background:rgba(255,0,60,0.08)!important;}
}
</style></head><body>`;

  // PAGE 1: COVER + STATS + PLAN
  html += `<div class="page">`;

  // Cover header — ElForma (branded with user name + domain)
  html += `<div class="cover-shell">
    <div class="cover-glow glow-a"></div>
    <div class="cover-glow glow-b"></div>
    <div class="brand-row">
      <div class="brand-mark">
        <div class="brand-logo-fb" style="overflow:hidden;padding:0;background:transparent;box-shadow:0 10px 28px -8px rgba(0,212,170,0.5);"><img src="data:image/png;base64,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" alt="ElForma" style="width:50px;height:50px;object-fit:contain;"></div>
        <div class="brand-text">
          <div class="brand-name">${siteName}</div>
          <div class="brand-name-ar">الفورمة</div>
          <div class="brand-domain">${siteDomain}</div>
        </div>
      </div>
      <div class="cover-badge">PREMIUM PLAN</div>
    </div>
    <div class="cover-divider"></div>
    <div class="cover-hello">${helloLine}</div>
    <div class="cover-title">خطة تمرينك المخصصة</div>
    <div class="cover-sub">${splitName} · ${goalTxt} · ${state.days} أيام/أسبوع</div>
    <div class="cover-meta">
      <span class="meta-pill accent">${new Date().toLocaleDateString('ar-EG',{year:'numeric',month:'long',day:'numeric'})}</span>
      <span class="meta-pill">${goalTxt}</span>
      <span class="meta-pill">خطة ذكية شخصية</span>
    </div>
  </div>`;

  // Stats — single 6-card grid, correct order
  html += `<div class="stats-row" style="grid-template-columns:repeat(3,1fr);grid-template-rows:auto auto;">
    <div class="stat-card"><div class="stat-val">${state.weight} كجم</div><div class="stat-lbl">الوزن الحالي</div></div>
    <div class="stat-card"><div class="stat-val">${state.tdee}</div><div class="stat-lbl">TDEE (kcal)</div></div>
    <div class="stat-card"><div class="stat-val">${state.recoveryScore}%</div><div class="stat-lbl">Recovery Score</div></div>
    <div class="stat-card"><div class="stat-val">${Math.round(state.weight*1.8)}g</div><div class="stat-lbl">بروتين يومي</div></div>
    <div class="stat-card"><div class="stat-val">${state.goal=='cut'?state.tdee-400:state.goal=='muscle'?state.tdee+250:state.tdee}</div><div class="stat-lbl">هدف السعرات</div></div>
    <div class="stat-card"><div class="stat-val">${state.bmi?.toFixed(1)||'-'}</div><div class="stat-lbl">مؤشر BMI</div></div>
  </div>`;

  // Week overview strip
  html += '<div class="week-strip">' + plan.map(function(d,i){
    var ico = d.isRest ? '&#128564;' : (['&#128170;','&#127947;&#65039;','&#129461;','&#128165;','&#9889;'][i % 5]);
    var arDay = d.isRest ? 'راحة' : ((d.name||'').split('—')[0].trim()||('D'+(i+1)));
    var chipBg = d.isRest ? 'rgba(61,80,112,0.18)' : 'rgba(0,212,170,0.07)';
    var chipBdr = d.isRest ? 'rgba(61,80,112,0.35)' : 'rgba(0,212,170,0.22)';
    var chipClr = d.isRest ? '#5a7090' : '#00D4AA';
    return '<div class="week-day-chip" style="background:'+chipBg+';border:1px solid '+chipBdr+';"><div class="wdc-icon">'+ico+'</div><div class="wdc-num" style="color:'+chipClr+';font-size:12px;">'+arDay+'</div></div>';
  }).join('') + '</div>';

  // Injury warnings
  if(!state.injuries.includes('none') && state.injuries.length > 0){
    html += `<div class="injury-box"> <b>تحذيرات الإصابات:</b><br>${state.injuries.map(i=>injMsgs[i]||i).join('<br>')}</div>`;
  }
  if(state.weak && state.weak.length > 0){
    html += `<div class="weak-box"> <b>عضلات تحتاج تركيز إضافي:</b> ${state.weak.join(' · ')}</div>`;
  }

  // Days
  plan.forEach((day, idx)=>{
    const exs = day.exercises||[];
    const color = dayColorHex[idx % dayColorHex.length];

    // يوم الراحة = راحة 100% — بطاقة بسيطة بدون تمارين أو إحماء
    if (day.isRest) {
      html += `<div class="day-section" style="page-break-inside:avoid;">
        <div class="day-header" style="background:linear-gradient(135deg,rgba(40,55,80,0.2),rgba(20,30,55,0.1));border-bottom:1px solid rgba(61,80,112,0.3);">
          <div class="day-header-content">
            <div class="day-header-left">
              <div class="day-num-wrap">
                <div class="day-num" style="background:#3d5070;box-shadow:0 6px 16px -6px #3d507088;">${idx+1}</div>
                <div class="day-num-label" style="color:#5a7090;">REST</div>
              </div>
              <div class="day-info">
                <div class="day-type-label" style="color:#5a7090;">REST DAY</div>
                <div class="day-name" style="color:#8097c4;">يوم ${idx+1} — يوم راحة كامل</div>
                <div class="day-muscles-row"><span class="muscle-chip" style="color:#4a6080;border-color:rgba(61,80,112,0.3);">لا تمارين</span><span class="muscle-chip" style="color:#4a6080;border-color:rgba(61,80,112,0.3);">راحة 100%</span></div>
              </div>
            </div>
            <div class="day-right">
              <div class="day-icon">&#128564;</div>
              <div class="day-badge" style="background:rgba(61,80,112,0.2);border-color:rgba(61,80,112,0.3);color:#5a7090;">راحة</div>
            </div>
          </div>
        </div>
        <div class="rest-day-content">
          <div class="rest-day-icon">&#128164;</div>
          <div>
            <div class="rest-day-title">الراحة جزء من التدريب</div>
            <div class="rest-day-sub">النوم الكافي والتغذية الجيدة هما كل ما تحتاجه اليوم — لا تمارين، لا إحماء، لا استرتش</div>
          </div>
        </div>
      </div>`;      return;
    }

    const _dayIcons=['&#128170;','&#127947;&#65039;','&#129461;','&#128165;','&#9889;','&#128170;','&#127947;&#65039;','&#129461;','&#128165;','&#9889;'];
    const _dayTypeName = (day.name||'').split('\u2014')[0].trim().split(' ').slice(-1)[0];
    const _dayIcon = _dayIcons[idx % _dayIcons.length];
    const _muscleTags = (day.muscles||[]).slice(0,5).map(m=>`<span class="muscle-chip">${m}</span>`).join('');
    html += `<div class="day-section" style="page-break-inside:avoid;">
      <div class="day-header" style="background:linear-gradient(135deg,${color}28,${color}0d);border-bottom:1px solid ${color}66;">
        <div class="day-header-content">
          <div class="day-header-left">
            <div class="day-num-wrap">
              <div class="day-num" style="background:linear-gradient(135deg,${color},${color}99);box-shadow:0 6px 16px -6px ${color}88;">${idx+1}</div>
              <div class="day-num-label" style="color:${color};">DAY</div>
            </div>
            <div class="day-info">
              <div class="day-type-label" style="color:${color};">${_dayTypeName.toUpperCase()} DAY</div>
              <div class="day-name">يوم ${idx+1} — ${mixedText(day.name.split('\u2014')[0].trim())}</div>
              <div class="day-muscles-row">${_muscleTags}</div>
            </div>
          </div>
          <div class="day-right">
            <div class="day-icon">${_dayIcon}</div>
            <div class="day-badge" style="background:rgba(255,255,255,0.07);border-color:${color}66;color:${color};">${exs.length} تمرين</div>
          </div>
        </div>
      </div>`;

    // Warmup
    if(day.warm && day.warm.length > 0){
      html += `<div class="warmup-strip">
        <span class="warmup-label"> إحماء:</span>
        ${day.warm.slice(0,4).map(w=>`<span class="warmup-tag">${w}</span>`).join('')}
      </div>`;
    }

    // Exercises table
    html += `<table class="ex-table" style="background:#0e0e1a;">
      <thead><tr style="background:${color}22;">
        <th class="col-num" style="width:35px;text-align:center;">#</th>
        <th>التمرين / العضلة</th>
        <th class="col-tier" style="width:60px;text-align:center;">مستوى</th>
        <th class="col-sets" style="width:90px;text-align:center;">مجموعات × عدات</th>
        <th class="col-rest" style="width:90px;text-align:center;">راحة</th>
        <th class="col-alt">البديل</th>
        <th class="col-vid" style="width:80px;text-align:center;">فيديو</th>
      </tr></thead><tbody>`;

    exs.forEach((ex, ei)=>{
      const isBlocked = ex.blocked;
      const isWeak = ex._weakPoint;
      html += `<tr ${isBlocked?'class="inj-warn-row"':''} ${isWeak?'style="background:rgba(255,107,138,0.06);"':''}>
        <td class="col-num" style="text-align:center;"><div class="ex-num-circle" style="background:${isWeak?'#ff6b8a':color};margin:0 auto;">${ei+1}</div></td>
        <td>
          <div class="ex-name-main" dir="rtl">${mixedText(ex.n)}${isBlocked?' ':''}${isWeak?` <span style="font-size:8px;font-weight:800;background:rgba(255,107,138,0.15);color:#ff6b8a;border:1px solid rgba(255,107,138,0.3);padding:1px 6px;border-radius:6px;margin-right:4px;"> Weak Point</span>`:''}</div>
          <div class="ex-name-mu">${ex.mu||''}</div>
          <div class="ex-alt-mobile" style="display:none;font-size:9px;color:#7070a0;margin-top:2px;"> - ${ex.alt||''}</div>
        </td>
        <td class="col-tier" style="text-align:center;"><span class="${ex.tier==='S'?'tier-s':'tier-a'}">${ex.tier||'A'}-Tier</span></td>
        <td class="col-sets" style="text-align:center;"><span class="sets-badge">${ex.sets||'3'} × ${ex.reps||'12'}</span></td>
        <td class="col-rest" style="text-align:center;"><span class="rest-badge">${ex.rest?fmtRest(ex.rest):'60 ثانية'}</span></td>
        <td class="col-alt"><span class="alt-txt">${ex.alt ? ' - '+ex.alt : (ex.desc||'')}</span></td>
        <td class="col-vid" style="text-align:center;"><a href="${safeVidUrl(ex.vid, ex.grp||ex._weakLabel||'default')}" target="_blank" rel="noopener" class="vid-link">▶ شاهد</a></td>
      </tr>`;
    });

    html += `</tbody></table>`;

    // Stretch & cooldown removed from PDF view per user request

    html += `</div>`; // end day-section
  });

  // ── PATCH 5: Always include Warmup Section in PDF export ──────────────
  html += `<div style="margin-top:20px;page-break-inside:avoid;border-radius:14px;overflow:hidden;border:1px solid rgba(245,200,66,0.3);background:rgba(245,200,66,0.04);">
    <div style="background:rgba(245,200,66,0.12);padding:12px 18px;border-bottom:1px solid rgba(245,200,66,0.2);display:flex;align-items:center;gap:10px;">
      <span style="font-size:18px;"></span>
      <span style="font-size:14px;font-weight:900;color:#fbbf24;">بروتوكول الإحماء الثابت — Upper & Lower Body</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;padding:14px 18px;gap:14px;">
      <div>
        <div style="font-size:11px;font-weight:800;color:#fbbf24;margin-bottom:8px;"> إحماء الجزء العلوي</div>
        ${WARMUP.upper.map(w=>`<div style="font-size:10px;padding:4px 10px;margin-bottom:4px;background:rgba(251,191,36,0.08);color:#fde68a;border-radius:8px;">${w}</div>`).join('')}
        <div style="margin-top:8px;display:flex;flex-direction:column;gap:4px;">
          <a href="https://www.youtube.com/shorts/YslX2dqLvxM" target="_blank" rel="noopener" class="vid-link">▶ فيديو 1</a>
          <a href="https://www.youtube.com/shorts/0gHLR5jaYCk" target="_blank" rel="noopener" class="vid-link">▶ فيديو 2</a>
        </div>
      </div>
      <div>
        <div style="font-size:11px;font-weight:800;color:#60a5fa;margin-bottom:8px;"> إحماء الجزء السفلي</div>
        ${WARMUP.lower.map(w=>`<div style="font-size:10px;padding:4px 10px;margin-bottom:4px;background:rgba(59,130,246,0.08);color:#93c5fd;border-radius:8px;">${w}</div>`).join('')}
        <div style="margin-top:8px;display:flex;flex-direction:column;gap:4px;">
          <a href="https://www.youtube.com/watch?v=IsRCKPIk86o" target="_blank" rel="noopener" class="vid-link">▶ فيديو 1</a>
          <a href="https://www.youtube.com/shorts/M7qRIigeUMc" target="_blank" rel="noopener" class="vid-link">▶ فيديو 2</a>
        </div>
      </div>
    </div>
    <div style="padding:8px 18px 12px;font-size:10px;color:#9898c0;line-height:1.7;">
       ابدأ دائما ب Ramp-Up Sets: 50% × 10 عدات - 70% × 6 - وزن العمل
    </div>
  </div>`;

  // ── PATCH 6: Always include Stretch Protocol in PDF export ───────────────
  html += `<div style="margin-top:16px;page-break-inside:avoid;border-radius:14px;overflow:hidden;border:1px solid rgba(45,212,160,0.3);background:rgba(45,212,160,0.03);">
    <div style="background:rgba(45,212,160,0.12);padding:12px 18px;border-bottom:1px solid rgba(45,212,160,0.2);display:flex;align-items:center;gap:10px;">
      <span style="font-size:18px;"></span>
      <span style="font-size:14px;font-weight:900;color:#2dd4a0;">بروتوكول الاسترتش بعد التمرين — إلزامي بعد كل جلسة</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;padding:14px 18px;">

      <div>
        <div style="font-size:11px;font-weight:800;color:#2dd4a0;margin-bottom:8px;"> جزء علوي (صدر، أكتاف، ذراع)</div>
        ${STRETCH.chest.map(s=>`<div style="font-size:10px;padding:4px 10px;margin-bottom:4px;background:rgba(45,212,160,0.07);color:#a0f5d8;border-radius:8px;">${s}</div>`).join('')}
        <div style="margin-top:8px;display:flex;flex-direction:column;gap:4px;">
          <a href="https://www.youtube.com/shorts/OZ1sPerv9kA" target="_blank" rel="noopener" class="vid-link">▶ فيديو الجزء العلوي 1</a>
          <a href="https://www.youtube.com/shorts/LBZvfBYcxAU" target="_blank" rel="noopener" class="vid-link">▶ فيديو الجزء العلوي 2</a>
        </div>
      </div>

      <div>
        <div style="font-size:11px;font-weight:800;color:#60a5fa;margin-bottom:8px;"> جزء سفلي (كوادز، هامستينج، سمانة)</div>
        ${STRETCH.legs.map(s=>`<div style="font-size:10px;padding:4px 10px;margin-bottom:4px;background:rgba(59,130,246,0.08);color:#93c5fd;border-radius:8px;">${s}</div>`).join('')}
        <div style="margin-top:8px;display:flex;flex-direction:column;gap:4px;">
          <a href="https://www.youtube.com/shorts/1Mr9N8tN-Uw" target="_blank" rel="noopener" class="vid-link">▶ فيديو الجزء السفلي 1</a>
          <a href="https://www.youtube.com/shorts/ExqOGQIn6RE" target="_blank" rel="noopener" class="vid-link">▶ فيديو الجزء السفلي 2</a>
        </div>
      </div>

      <div>
        <div style="font-size:11px;font-weight:800;color:#c084fc;margin-bottom:8px;"> ظهر وجلوتس</div>
        ${STRETCH.back.map(s=>`<div style="font-size:10px;padding:4px 10px;margin-bottom:4px;background:rgba(168,85,247,0.08);color:#d8b4fe;border-radius:8px;">${s}</div>`).join('')}
        ${STRETCH.glutes.map(s=>`<div style="font-size:10px;padding:4px 10px;margin-bottom:4px;background:rgba(168,85,247,0.08);color:#d8b4fe;border-radius:8px;">${s}</div>`).join('')}
        <div style="margin-top:8px;display:flex;flex-direction:column;gap:4px;">
          <a href="https://www.youtube.com/shorts/n-K9EP3hAVM" target="_blank" rel="noopener" class="vid-link">▶ فيديو الظهر والجلوتس 1</a>
          <a href="https://www.youtube.com/shorts/Tlq03VyQa7Y" target="_blank" rel="noopener" class="vid-link">▶ فيديو الظهر والجلوتس 2</a>
        </div>
      </div>

    </div>
    <div style="padding:8px 18px 12px;font-size:10px;color:#9898c0;line-height:1.7;">
       <b style="color:#2dd4a0;">قاعدة ذهبية:</b> امسك كل وضعية 30–45 ثانية بدون ارتداد — التنفس الهادئ يعمق الاسترتش تلقائيا.
    </div>
  </div>`;

  html += `</div>`; // end page 1

  // ── EXPORT HELPER: build modules section HTML for PDF ──────────────────
  const activeM = state.activeModules || [];
  const modNameAr = {
    cardio:'بروتوكول الكارديو', core:'بروتوكول الكور', kegel:'تمارين الكيجل',
    yoga:'جلسة اليوغا', mobility:'Mobility & Flex', stretching:'بروتوكول الاسترتش',
    breathing:'التنفس والمايندسيت', sleep:'بروتوكول التعافي',
    weakpoint:'تمارين نقاط الضعف', deload:'أسبوع Deload', nutrition:'دليل التغذية'
  };
  const modIconAr = {
    cardio:'', core:'', kegel:'', yoga:'', mobility:'',
    stretching:'', breathing:'', sleep:'', weakpoint:'',
    deload:'', nutrition:''
  };

  if(activeM.length > 0){
    html += `<div class="page page-break">
      <div class="recovery-title" style="font-size:18px;font-weight:900;color:#a855f7;margin-bottom:18px;display:flex;align-items:center;gap:10px;">
         الوحدات التدريبية الذكية المختارة
      </div>
      <div style="font-size:11px;color:#7070a0;margin-bottom:16px;">تم تفعيل ${activeM.length} وحدة مساعدة مخصصة بناء على هدفك ومستوى تعافيك</div>`;

    activeM.forEach(modId => {
      const db = MODULE_DB[modId];
      if(!db) return;
      // Weak Point: مدمج مباشرة في تمارين الخطة — يعرض ملاحظة توضيحية فقط
      if(modId === 'weakpoint'){
        const weakList = state.weak || [];
        const weakNames = {chest:'صدر',back:'ظهر',shoulders:'أكتاف',arms:'ذراع',legs:'أرجل',glutes:'جلوتس',core:'كور',calves:'سمانة',forearms:'ساعد'};
        html += `<div style="margin-bottom:18px;border-radius:12px;overflow:hidden;border:1px solid rgba(255,107,138,0.3);">
          <div style="background:rgba(255,107,138,0.1);padding:11px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(255,107,138,0.2);">
            <span style="font-size:16px;"></span>
            <span style="font-size:13px;font-weight:900;color:#ffaac7;">Weak Point Focus — تمارين نقاط الضعف</span>
          </div>
          <div style="background:#0e0e1a;padding:14px 16px;">
            <div style="font-size:10px;color:#ff9bbb;background:rgba(255,107,138,0.08);border:1px solid rgba(255,107,138,0.2);border-radius:8px;padding:8px 12px;margin-bottom:10px;line-height:1.7;">
               تم دمج ${weakList.length} منطقة ضعيفة مباشرة داخل أيام تدريب العضلات المستهدفة — تمرين واحد × 3 مجموعات لكل منطقة، مختلف عن تمارين الجلسة. لا ينشأ يوم تدريب جديد.
            </div>
            ${weakList.map(w=>`<div style="font-size:10px;padding:4px 10px;margin-bottom:4px;background:rgba(255,107,138,0.07);color:#ffaac7;border-radius:7px;"> ${weakNames[w]||w} — تمت إضافة 3 مجموعات إضافية في يوم تدريب هذه العضلة</div>`).join('')}
          </div>
        </div>`;
        return;
      }
      const exercises = Array.isArray(db) ? db : (db.s||[]).concat(db.a||[]).concat(db.b||[]);
      const topExs = exercises.slice(0, 5);
      html += `<div style="margin-bottom:18px;border-radius:12px;overflow:hidden;border:1px solid rgba(168,85,247,0.25);">
        <div style="background:rgba(168,85,247,0.12);padding:11px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(168,85,247,0.2);">
          <span style="font-size:16px;">${modIconAr[modId]||''}</span>
          <span style="font-size:13px;font-weight:900;color:#d8b4fe;">${modNameAr[modId]||modId}</span>
        </div>
        <table class="ex-table" style="background:#0e0e1a;">
          <thead><tr style="background:rgba(168,85,247,0.08);">
            <th style="width:35px;text-align:center;">#</th>
            <th>التمرين</th>
            <th style="width:60px;">Tier</th>
            <th>التوقيت / المجموعات</th>
            <th>الوصف</th>
            <th style="width:80px;text-align:center;">▶ فيديو</th>
          </tr></thead><tbody>`;
      topExs.forEach((ex, ei) => {
        const timing = ex.duration||ex.sets||ex.protocol||'—';
        // Resolve video URL using the same pipeline as the UI
        const rawCatP = ex.category || ex.grp || modId || 'default';
        const modCatToGrpP = {
          pelvic_floor:'kegel', cardio_liss:'cardio', cardio_hiit:'cardio', cardio_steady:'cardio',
          core_weighted:'core', core_bodyweight:'core', core_isometric:'core',
          core_anti_rotation:'core', core_rotation:'core', core_stability:'core',
          mobility_hip:'mobility', mobility_spine:'mobility', mobility_shoulder:'mobility',
          mobility_ankle:'mobility', mobility_full:'mobility', stretch_static:'stretching',
          yoga_flow:'yoga', yoga_restorative:'yoga', yoga_active:'yoga',
          yoga_standing:'yoga', yoga_balance:'yoga', breathwork:'breathing', mindset:'breathing',
          recovery_active:'recovery', recovery_mobility:'recovery', recovery_stretch:'recovery',
          recovery_smr:'recovery', recovery_breathing:'recovery', recovery_thermal:'recovery'
        };
        const grpKeyP = modCatToGrpP[rawCatP] || modId || 'default';
        const vidUrlP = safeVidUrl(ex.vid, grpKeyP);
        html += `<tr>
          <td style="text-align:center;"><div class="ex-num-circle" style="background:#7835d7;margin:0 auto;">${ei+1}</div></td>
          <td><div class="ex-name-main" dir="rtl">${mixedText(ex.n)}</div></td>
          <td><span class="${ex.tier==='S'?'tier-s':'tier-a'}">${ex.tier}-Tier</span></td>
          <td style="font-size:10px;color:#b0aaff;">${timing}</td>
          <td><span class="alt-txt">${ex.desc||''}</span></td>
          <td style="text-align:center;"><a href="${vidUrlP}" target="_blank" rel="noopener" class="vid-link" style="font-size:10px;">▶ شاهد</a></td>
        </tr>`;
      });
      html += `</tbody></table></div>`;
    });

    html += `<div class="footer-bar">
      <span>${siteName} · <span style="color:#7fa8c8;">${siteDomain}</span> · الوحدات الذكية</span>
      <span>${new Date().toLocaleDateString('ar-EG')}</span>
    </div></div>`;
  }

  // PAGE 3: MESOCYCLE LONG-TERM PLAN ─────────────────────────────────────
  {
    const expM = state.exp;
    const recM = state.recoveryScore || 70;
    let totalWeeks;
    if(expM==='beginner') totalWeeks=8;
    else if(expM==='advanced') totalWeeks=12;
    else totalWeeks = recM>=75 ? 10 : 8;

    // Phase data assembled from mesocycle engine (read-only export representation)
    const mesoPhases8 = [
      {num:1,name:'التكيف والأساس',weeks:'1–2',load:'60–70%',rir:'3–4 RIR',vol:'100%',deload:false,
       inst:'نفذ برنامجك بشكل طبيعي. ركز على الشكل الصحيح. لا تتجاوز RPE 7.'},
      {num:2,name:'الحمل التدريجي',weeks:'3–5',load:'70–80%',rir:'2–3 RIR',vol:'110%',deload:false,
       inst:`أضف ${state.goal==='strength'?'2.5–5':'1–2.5'} كجم أسبوعيا. سجل كل جلسة.`},
      {num:3,name:'التكثيف',weeks:'6–7',load:'80–87%',rir:'1–2 RIR',vol:'115%',deload:false,
       inst:'ادفع بثقة. الأسبوع 7: أعلى شدة في الدورة'},
      {num:4,name:'Deload — التعافي',weeks:'8',load:'50–60%',rir:'4–5 RIR',vol:'50%',deload:true,
       inst:'نفس التمارين — نصف الوزن ونصف المجموعات. ترطيب ونوم'}
    ];
    const mesoPhases10 = [
      ...mesoPhases8.slice(0,2),
      {num:3,name:'Deload متوسطي',weeks:'6',load:'55–65%',rir:'4 RIR',vol:'60%',deload:true,
       inst:'تخفيف منتصفي — يمنع تراكم الإجهاد قبل التكثيف'},
      {num:4,name:'التكثيف المتقدم',weeks:'7–9',load:'80–88%',rir:'1–2 RIR',vol:'115%',deload:false,
       inst:'استمر بزيادة الأوزان. أسبوع 9: حد الأداء الأعلى'},
      {num:5,name:'Deload الختامي',weeks:'10',load:'50–60%',rir:'4–5 RIR',vol:'50%',deload:true,
       inst:'إتمام الدورة. تعاف كامل. تقييم التقدم'}
    ];
    const mesoPhases12 = [
      ...mesoPhases8.slice(0,2),
      {num:3,name:'Deload متوسطي',weeks:'6',load:'55–65%',rir:'4 RIR',vol:'60%',deload:true,
       inst:'إعادة ضبط عصبي بعد 5 أسابيع حمل'},
      {num:4,name:'التكثيف',weeks:'7–9',load:'80–87%',rir:'1–2 RIR',vol:'115%',deload:false,
       inst:'ادفع بثقة. قس تقدم المرحلة الثانية وتجاوزه'},
      {num:5,name:'التخصص والذروة',weeks:'10–11',load:'82–90%',rir:'1 RIR',vol:'115%',deload:false,
       inst:'ذروة الأداء. تخصص على نقاط الضعف المحددة'},
      {num:6,name:'Deload الختامي',weeks:'12',load:'50–60%',rir:'4–5 RIR',vol:'50%',deload:true,
       inst:'نهاية الدورة. تعاف كامل. ابدأ دورة جديدة بمستوى أعلى'}
    ];
    const phases = totalWeeks===8?mesoPhases8:totalWeeks===10?mesoPhases10:mesoPhases12;
    const expAr = {beginner:'مبتدئ',intermediate:'متوسط',advanced:'متقدم'}[expM]||expM;
    const goalAr = {cut:'تنشيف',muscle:'ضخامة',strength:'قوة',fitness:'لياقة'}[state.goal]||state.goal;

    html += `<div class="page page-break">
      <div class="recovery-title" style="font-size:18px;font-weight:900;color:#6c63ff;margin-bottom:6px;display:flex;align-items:center;gap:10px;">
         خطة الدورة التدريبية الطويلة — Mesocycle
      </div>
      <div style="font-size:11px;color:#7070a0;margin-bottom:16px;">${expAr} · ${goalAr} · ${totalWeeks} أسابيع · Recovery ${recM}%</div>
      <div style="background:#141422;border:1px solid rgba(108,99,255,0.25);border-radius:12px;padding:10px 14px;margin-bottom:16px;font-size:10px;color:#9898c0;line-height:1.8;">
         هذا ال Mesocycle ينظم شدة التدريب وتعافيك على ${totalWeeks} أسابيع. برنامجك الأسبوعي يبقى ثابتا — فقط الشدة والحجم يتغيران حسب المرحلة.
      </div>`;

    phases.forEach(ph => {
      const phColor = ph.deload ? '#00D4AA' : ph.num<=2 ? '#3b82f6' : ph.num<=4 ? '#6c63ff' : '#ff7a1a';
      html += `<div style="margin-bottom:14px;border-radius:12px;overflow:hidden;border:1px solid ${phColor}30;">
        <div style="background:${phColor}18;padding:10px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid ${phColor}25;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:28px;height:28px;border-radius:50%;background:${phColor};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#fff;">${ph.num}</div>
            <div>
              <div style="font-size:12px;font-weight:800;color:#eeeeff;">${ph.name}</div>
              <div style="font-size:9px;color:#7070a0;">الأسابيع: ${ph.weeks}</div>
            </div>
          </div>
          <span style="font-size:9px;font-weight:800;padding:3px 10px;border-radius:10px;background:${phColor}20;color:${phColor};">
            ${ph.deload ? ' Deload' : ' تقدم'}
          </span>
        </div>
        <div style="background:#0e0e1a;padding:12px 16px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
          <div style="text-align:center;background:#141422;border:1px solid #252540;border-radius:8px;padding:8px 4px;">
            <div style="font-size:14px;font-weight:900;color:${phColor};">${ph.load}</div>
            <div style="font-size:8px;color:#55557a;font-weight:700;margin-top:2px;">الحمل النسبي</div>
          </div>
          <div style="text-align:center;background:#141422;border:1px solid #252540;border-radius:8px;padding:8px 4px;">
            <div style="font-size:12px;font-weight:900;color:${ph.deload?'#00D4AA':'#fbbf24'};">${ph.rir}</div>
            <div style="font-size:8px;color:#55557a;font-weight:700;margin-top:2px;">هامش RIR</div>
          </div>
          <div style="text-align:center;background:#141422;border:1px solid #252540;border-radius:8px;padding:8px 4px;">
            <div style="font-size:14px;font-weight:900;color:#8b83ff;">${ph.vol}</div>
            <div style="font-size:8px;color:#55557a;font-weight:700;margin-top:2px;">الحجم النسبي</div>
          </div>
        </div>
        <div style="background:#080810;padding:8px 16px;font-size:10px;color:#7070a0;border-top:1px solid #1e1e30;">
           ${ph.inst}
        </div>
      </div>`;
    });

    html += `<div style="background:rgba(108,99,255,0.06);border:1px solid rgba(108,99,255,0.2);border-radius:10px;padding:10px 14px;font-size:10px;color:#8b83ff;line-height:1.8;margin-top:6px;">
       <b>بعد إتمام الدورة:</b> ابدأ دورة جديدة برفع الهدف — زد الأوزان، غير السبليت، أو ارفع عدد الأيام.
    </div>
    <div class="footer-bar">
      <span>${siteName} · <span style="color:#7fa8c8;">${siteDomain}</span> · Mesocycle Plan</span>
      <span>${new Date().toLocaleDateString('ar-EG')}</span>
    </div></div>`;
  }

  // PAGE 2: RECOVERY & PROGRESS GUIDE
  html += `<div class="page page-break">
    <div class="recovery-page">
      <div class="recovery-title"> دليل التعافي والتقدم</div>
      <div class="rec-grid">
        <div class="rec-card">
          <div class="rec-card-title"> Progressive Overload</div>
          <div class="rec-card-body">
            أضف <b>${state.goal==='strength'?'2.5-5':'1-2.5'} كجم</b> كل أسبوع عند إتمام جميع العدات بشكل مثالي<br>
            لا ترفع الوزن إذا كانت صورة التمرين تتأثر<br>
            سجل كل جلسة في ملف المتابعة XLSX.
          </div>
        </div>
        <div class="rec-card">
          <div class="rec-card-title"> Deload Week</div>
          <div class="rec-card-body">
            كل <b>4-6 أسابيع</b> خفف الحجم التدريبي 50%.<br>
            نفس الحركات، نصف المجموعات، 40% الأوزان<br>
            يمنع الإجهاد المزمن ويعيد شحن الجهاز العصبي.
          </div>
        </div>
        <div class="rec-card">
          <div class="rec-card-title"> النوم والتعافي</div>
          <div class="rec-card-body">
            هدف: <b>8 ساعات</b> نوم متواصل<br>
            تعافيك الحالي: <b style="color:#00D4AA">${state.recoveryScore}%</b><br>
            ماغنيسيوم قبل النوم يحسن العمق والجودة<br>
            تجنب الكافيين بعد 4 مساء.
          </div>
        </div>
        <div class="rec-card">
          <div class="rec-card-title"> البروتين والسعرات</div>
          <div class="rec-card-body">
            البروتين اليومي: <b style="color:#00D4AA">${Math.round(state.weight*1.8)}g</b> (${Math.round(state.weight*1.8/4)} وجبات)<br>
            TDEE: <b>${state.tdee} kcal</b><br>
            هدف السعرات: <b>${state.goal==='cut'?state.tdee-400:state.goal==='muscle'?state.tdee+250:state.tdee} kcal</b><br>
            راجع أسبوعيا بناء على تغير الوزن.
          </div>
        </div>
        <div class="rec-card">
          <div class="rec-card-title"> RPE وشدة التمرين</div>
          <div class="rec-card-body">
            استهدف <b>RPE 7-8</b> في كل مجموعة<br>
            RPE 9-10 = إرهاق — تجنبه في كل جلسة<br>
            اترك 1-2 تكرار احتياطي (RIR 1-2).<br>
            ارفع الشدة تدريجيا لا فجأة.
          </div>
        </div>
        <div class="rec-card">
          <div class="rec-card-title"> الوقاية من الإصابات</div>
          <div class="rec-card-body">
            ${!state.injuries.includes('none') && state.injuries.length>0
              ? state.injuries.map(i=>injMsgs[i]||i).join('<br>')
              : 'لا توجد إصابات حالية '}
            <br>سخن دائما 5-10 دقائق قبل البدء.
          </div>
        </div>
        <div class="rec-card">
          <div class="rec-card-title"> الترطيب</div>
          <div class="rec-card-body">
            اشرب <b>3-4 لترات</b> ماء يوميا.<br>
            أضف كهارل (ملح + ليمون) في أيام التمرين الشديد<br>
            تجنب الجفاف — يخفض الأداء بنسبة 10%+
          </div>
        </div>
        <div class="rec-card">
          <div class="rec-card-title"> التقييم الأسبوعي</div>
          <div class="rec-card-body">
            راجع التقدم كل أسبوع في ملف المتابعة<br>
            قس الأوزان والمقاسات مرة كل أسبوعين<br>
            عدل الخطة كل 6 أسابيع بناء على النتائج.
          </div>
        </div>
      </div>
    </div>
    <div class="footer-bar">
      <span>${siteName} · <span style="color:#7fa8c8;">${siteDomain}</span> · ${splitName}</span>
      <span>${new Date().toLocaleDateString('ar-EG')}</span>
    </div>
  </div>

  <!-- ═══ صفحة استراتيجيات تمرين العضلات الرئيسية ═══ -->
  <div class="page" style="page-break-before:always;">
    <div style="background:linear-gradient(135deg,rgba(108,99,255,0.15),rgba(108,142,245,0.08));border:1px solid rgba(108,142,245,0.25);border-radius:16px;padding:22px 20px;margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        <span style="font-size:22px;"></span>
        <div>
          <div style="font-size:17px;font-weight:900;color:#eeeeff;">استراتيجيات تمرين العضلات الرئيسية</div>
          <div style="font-size:10px;color:#7070a0;margin-top:3px;">أفضل نطاق عدات وتوزيع الألياف لكل عضلة · بناء على علم الفسيولوجيا العضلية</div>
        </div>
      </div>
      <div style="font-size:11px;color:#9898c0;line-height:1.7;padding:10px 14px;background:rgba(108,142,245,0.05);border:1px solid rgba(108,142,245,0.12);border-radius:10px;">
        فيما يلي تفصيل لأهم المجموعات العضلية وتوصيات التدريب المثلى بناء على تكوين ألياف كل عضلة وأبحاث الفسيولوجيا التطبيقية.
        <b style="color:#b0aaff;">استخدم هذا المرجع لضبط نطاق العدات في برنامجك</b>
      </div>
    </div>

    <div style="border-radius:14px;border:1px solid #252540;overflow:hidden;">
      ${(window.MUSCLE_STRATEGY_DATA||MUSCLE_STRATEGY_DATA||[]).map((row, i, arr) => `
      <div style="padding:14px 18px;${i % 2 === 0 ? 'background:rgba(255,255,255,0.018);' : ''}${i < arr.length - 1 ? 'border-bottom:1px solid #1e1e30;' : ''}">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
          <span style="font-size:13px;font-weight:800;color:#eeeeff;">${row.name}</span>
          <div style="display:flex;gap:8px;">
            <span style="font-size:10px;font-weight:700;color:#38b6ff;background:rgba(56,182,255,0.1);border:1px solid rgba(56,182,255,0.2);padding:2px 10px;border-radius:10px;">&#9889; Fast ${row.fast}</span>
            <span style="font-size:10px;font-weight:700;color:#00e5b0;background:rgba(0,229,176,0.08);border:1px solid rgba(0,229,176,0.18);padding:2px 10px;border-radius:10px;">&#x1F504; Slow ${row.slow}</span>
          </div>
        </div>
        <div style="font-size:11px;color:#9898c0;line-height:1.7;padding:9px 12px;background:rgba(108,142,245,0.04);border-radius:9px;border-right:3px solid rgba(108,142,245,0.3);">${row.strategy}</div>
      </div>`).join('')}
    </div>

    <div style="margin-top:14px;padding:10px 14px;background:rgba(0,229,176,0.04);border:1px solid rgba(0,229,176,0.15);border-radius:10px;font-size:10px;color:#55557a;line-height:1.6;">
       <b style="color:#00D4AA;">ملاحظة:</b>
      النسب تقريبية وتتأثر بالجينات والتدريب المتراكم · عدات الخطة مصممة لتحقيق التوازن المثلى بين مدى العدات ·
      ينصح بتطبيق <b>Progressive Overload</b> خلال 4-6 أسابيع قبل تغيير النطاق.
    </div>

    <div class="footer-bar" style="margin-top:20px;">
      <span>${siteName} · <span style="color:#7fa8c8;">${siteDomain}</span> · ${splitName}</span>
      <span>${new Date().toLocaleDateString('ar-EG')}</span>
    </div>
  </div>

</body></html>`;

  return html;
}

function exportPlanPDF(){
  try{
    var plan = state.plan||[];
    if(!plan.length){ alert('لا توجد خطة تدريب. يرجى إكمال الخطوات أولا.'); return; }
    var splits = getSplits();
    var splitName = (splits[state.selectedSplit] && splits[state.selectedSplit].name) ? splits[state.selectedSplit].name : 'غير محدد';
    var goalLabels={cut:'تنشيف',muscle:'ضخامة',strength:'قوة',fitness:'لياقة'};
    var goalTxt = goalLabels[state.goal]||'-';
    var htmlContent = buildPDFHTML(plan, splitName, goalTxt);
    var fileName = 'خطة_تمرين_' + splitName.replace(/[\s/+]+/g,'_') + '.html';
    downloadBlob(htmlContent, fileName, 'text/html;charset=utf-8');
  }catch(e){ alert('حدث خطأ أثناء تحميل الخطة. يرجى المحاولة مجددا.'); console.error('PDF export error:',e); }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPORT TRACKER — XLSX PROFESSIONAL DASHBOARD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
