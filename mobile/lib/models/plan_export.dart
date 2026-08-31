// ── ElForma · models/plan_export.dart ──
// [بند 11] التصدير الاحترافي — النسخة الرسمية المُطوَّرة.
//
// التحسينات في هذا الإصدار:
//   1. لوجو احترافي + هوية بصرية موحدة في ملفَي التمرين والتغذية.
//   2. بيانات المتدرب الكاملة: الاسم، الطول، الوزن، الهدف، العمر.
//   3. إصلاح روابط الفيديو: جلب مباشر من حقل vid (YouTube ID) وبناء
//      رابط يوتيوب صحيح — لا روابط وهمية أو غير موجودة في الداتا.
//   4. اسم اليوم فقط بدون تفاصيل العضلات الجانبية.
//   5. جميع التمارين ظاهرة بلا حذف أو اقتصار.
//   6. اسم التمرين الحقيقي من حقل n أو name (مش مسمى عشوائي).
//   7. ملف التغذية بنفس مستوى الاحتراف والهوية البصرية.

import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

class PlanExport {
  static const String _brand = 'الفورمة';
  static const String _brandEn = 'ElForma';

  // --- utils ---------------------------------------------------------------

  static String _esc(Object? v) {
    final s = (v ?? '').toString();
    return s
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
  }

  static String _today() {
    final n = DateTime.now();
    String two(int x) => x < 10 ? '0$x' : '\${x}';
    return '${n.year}/${two(n.month)}/${two(n.day)}';
  }

  // --- video URL -----------------------------------------------------------

  /// يستخرج YouTube video ID من أي شكل ممكن:
  ///   - YouTube ID نص مباشر: 'hA4Y5b7xEDM'
  ///   - رابط youtu.be/hA4Y5b7xEDM
  ///   - رابط youtube.com/watch?v=hA4Y5b7xEDM
  ///   - رابط /embed/hA4Y5b7xEDM أو /shorts/hA4Y5b7xEDM
  /// لو مافيش vid صالح يرجع فراغ ← مش بنعرض أي رابط وهمي.
  static String _extractVideoId(dynamic raw) {
    final value = '\$raw'.trim();
    if (value.isEmpty ||
        value == 'null' ||
        value == 'undefined' ||
        value == 'none' ||
        value == 'NaN' ||
        value == '—') return '';
    // لو رابط كامل → نستخرج منه الـ ID
    if (value.startsWith('http://') || value.startsWith('https://')) {
      final uri = Uri.tryParse(value);
      if (uri != null) {
        if (uri.host.contains('youtu.be')) {
          return uri.pathSegments.isNotEmpty ? uri.pathSegments.first : '';
        }
        if (uri.host.contains('youtube.com')) {
          final v = uri.queryParameters['v'];
          if (v != null && v.isNotEmpty) return v;
          final parts = uri.pathSegments;
          final marker = parts.indexWhere((p) => p == 'embed' || p == 'shorts');
          if (marker >= 0 && marker + 1 < parts.length) return parts[marker + 1];
        }
      }
      return ''; // رابط مش يوتيوب → لا نعرضه
    }
    // YouTube ID عادةً 11 حرف alphanumeric + dash + underscore
    if (RegExp(r'^[A-Za-z0-9_\-]{8,14}\$').hasMatch(value)) return value;
    return '';
  }

  static const Map<String, String> _vidMap = {
    'Incline Barbell Press': 'hA4Y5b7xEDM',
    'Incline Dumbbell Press': 'Sj8t4vL-Ryw',
    'Incline Smith Machine Press': 'dTDhV_w1NoU',
    'Hammer Strength Incline Press': 'hkU6fSHcslw',
    'Low to High Cable Fly': 'BwqlWtr3v10',
    'Cable Upper Chest Crossover': 'X8X1ReVotR0',
    'Barbell Bench Press': 'XjrsqShr-Ic',
    'Dumbbell Bench Press': 'Ne_9EKkUVXY',
    'Machine Chest Press': 'Qu7-ceCvq7w',
    'Smith Machine Flat Press': '5rbI0TYcgiA',
    'Cable Chest Press': 'USAXajC6oUw',
    'Pec Deck Machine': 'SE3FR_LqaW8',
    'Seated Cable Fly': 'SE3FR_LqaW8',
    'Dips (Chest Variation)': '6ELKNQG-jRs',
    'Decline Barbell Press': 'nZGAtubdDrM',
    'Decline Dumbbell Press': 'm68nOljccd8',
    'High to Low Cable Fly': 'uu_Fcp-KN-0',
    'Decline Cable Fly': 'uu_Fcp-KN-0',
    'Wide Grip Lat Pulldown': 'bNmvKpJSWKM',
    'Neutral Grip Lat Pulldown': 'jXRxMJhOCc0',
    'Close Grip Pulldown': 'VZ4R9_E5BBE',
    'Lat Pullover Machine': 'TCvTnibKiCs',
    'Cable Pullover': 'yK6-CD9u2vQ',
    'Barbell Bent Over Row': 'phVtqawIgbk',
    'Chest Supported Row Machine': 'BwOscEHiqKQ',
    'Seated Cable Row': 'hnNjcQI9ZMU',
    'Meadows Row': 'eLrNUDTaMSk',
    'One Arm Dumbbell Row': 'RPDKC0M_P7Y',
    'Wide Grip Seated Row': 'p48Cf7htySA',
    'Smith Machine Row': 'sTuwq4Vcvag',
    'One Hand Cable Row': '0VDkEX5RBC8',
    'Single Arm Cable Row': 'yIvvQc2Z6uM',
    'Romanian Deadlift': 'HHoaBq8zoSM',
    'Stiff Leg Deadlift': 'gplY6YfPhDY',
    'Lower Back Extensions': 'uMr1txvrmgg',
    'Machine Shoulder Press': 'pFjJXU8S2gs',
    'Seated DB Shoulder Press': 'k6tzKisR3NY',
    'Overhead Barbell Press': 'qybgyITCwcI',
    'Smith Machine Shoulder Press': 'E7ngsffMPR0',
    'Cable Lateral Raise': 'lMJUXEvcMkQ',
    'Dumbbell Lateral Raise': 'C3sSWhFcEyY',
    'Machine Lateral Raise': '0o07iGKUarI',
    'Leaning Cable Lateral Raise': '23VoAvqwSzo',
    'Rope Face Pull': 'zzTdj6pnkxI',
    'Reverse Cable Crossover': 'cGXBVOc5xIk',
    'Rear Delt Machine Fly': '7tgx6QHB0-A',
    'Cable Rear Delt Fly': 'FeERX9UwspY',
    'Bent Over Rear Delt Raise': 'YjLf5zig7jg',
    'Overhead Cable Tricep Extension': 'QYc9NDoUrPM',
    'Skull Crushers (EZ Bar)': '1cikFylNxqw',
    'Dumbbell Overhead Tricep Ext': 'UOiuG9kbTZU',
    'Cable Overhead Curl': '9Ark9S11uXw',
    'Rope Tricep Pushdown': 'u36jNfqh8_U',
    'Bar Tricep Pushdown': '1FjkhpZsaxc',
    'Cable Tricep Kickback': '7_C9_SWHZbo',
    'Katana Extension': 'WmWIR6pq9hw',
    'Tricep Dips Machine': '7_C9_SWHZbo',
    'Bayesian Cable Curl': 'EhC6ejgDGF0',
    'Hammer Curl': 'jdYGDzCuGE4',
    'Incline Dumbbell Curl': 'K2C4Nf3zQyc',
    'Machine Preacher Curl': 'S4dDLfp3e8w',
    'EZ Bar Preacher Curl': 'S4dDLfp3e8w',
    'EZ Bar Curl': 'zta8JuQZC_A',
    'Standing Dumbbell Curl': 'MKWBV29S6c0',
    'Barbell Back Squat': 'i5tL8KwlkWE',
    'Hack Squat Machine': 'rYgNArpwE7E',
    'Smith Machine Squat': 'ue249CNAigc',
    'Pendulum Squat': '1vdoqE--qTA',
    'Leg Press (45°)': 'oFsPXMIbNR4',
    'Front Barbell Squat': 'rKjh8K-ZxLc',
    'Bulgarian Split Squat': 'or1frhkjBDc',
    'Leg Extension Machine': 'SQcjwqjOwb4',
    'Walking Lunges (Barbell)': 'EWBiNhxDnmQ',
    'Step-Up with Barbell': 'Ls73TInTRe4',
    'Sissy Squat': 'pU7XbxvViIY',
    'Leg Press Narrow Stance': 'eDgxpUNdbD8',
    'Romanian Deadlift (RDL)': 'xAL7lHwj30E',
    'Stiff-Leg Deadlift': 'CN_7cz3P-1U',
    'Single Leg RDL (Dumbbell)': 'kNZlId2h7i8',
    'Lying Leg Curl Machine': 'EfeVvA1vdd4',
    'Single Leg Curl Machine': 'bZuv_z8z8go',
    'Standing Leg Curl Machine': 'eFs1d8c5vRI',
    'Barbell Hip Thrust': 'ZSPmIyX9RZs',
    'Cable Pull Through': 'SbquVKT_2jg',
    'Smith Machine Hip Thrust': 'i5Vpsf-c6r0',
    'Standing Calf Raise (Machine)': 'baEXLy09Ncc',
    'Smith Machine Calf Raise': 'wlqTemUXPXY',
    'Leg Press Calf Raise': 'DvEnixpoSg0',
    'Donkey Calf Raise': 'watMaxAQBCU',
    'Seated Calf Raise Machine': 'OZlYFWLZ3cw',
    'Barbell Shrugs': 'IJSDHkN7qPc',
    'Smith Machine Shrugs': 'nd8eNnkFOKU',
    'Dumbbell Shrugs': 'gvC0ubD0hdQ',
    'Barbell Wrist Curl': 'd5YiFNoiCa0',
    'Reverse Barbell Wrist Curl': 'yz2eCSWoY4E',
    'Dumbbell Wrist Curl': '3PJSBYpWfWI',
    'Farmer Walk (Plates)': '5LKllcK6PfQ',
    'Dead Hangs': 'XPcT3capkyk',
    'Cable Crunch': 'iRYIqSFN21w',
    'Ab Wheel Rollout': 'tmy1wmws9z4',
    'Hanging Leg Raise': '2HgbXXA-uqE',
    'Cable Woodchop': '8OZImYISmSg',
    'Plank on Cable': 'k3Y2HGFRl6A',
    'Decline Sit-Up': 'G2vYhVJq_Nk',
    'Plank': 'k3Y2HGFRl6A',
    'Cable Hip Adduction': 'Q08rMkanmtc',
    'Seated Hip Adduction Machine': 'BmMmt-c9aNM',
    'Dumbbell Side Lunge': 'EwdQSgvBeZ4',
    'Goblet Squat (Dumbbell)': '29bKY-pAsdc',
    'Bulgarian Split Squat (Chair)': '1M-V_qlyowo',
    'Resistance Band Squat': 'S5cTdwO1Trk',
    'Step-Up (Chair/Box)': '3LrzsE3clIs',
    'Dumbbell Romanian Deadlift': 'HHoaBq8zoSM',
    'Glute Bridge Weighted': 'LORVjN2bg5o',
    'Standing Calf Raise (BW)': '27Vu1-5mv-4',
    'Single Leg Calf Raise': '4N9Flc-4JzU',
    'Dumbbell Shoulder Press (Seated)': 'KybK2zbg0n4',
    'Pike Push-Up': 'FlvG95fGrCM',
    'Battle Ropes': 'k3d8XozZyQQ',
    'Burpees': 'VTsD3quZ5HE',
    'Outdoor Jogging': 'uOY1rxnFY9w',
    'Incline Treadmill Walk': 'HwXYMPGjlUg',
    'Stationary Cycling (LISS)': 'NY4_GJnrfKQ',
    'Jump Rope (HIIT)': 'WtZxqC9ZKzI',
    'Stair Climber': 'Zz_9Hx82RLo',
  };

  /// يبني رابط يوتيوب كامل من map بيانات التمرين.
  /// يبحث أولاً في حقول البيانات، ثم في lookup table الداخلية بالاسم.
  static String _buildVideoUrl(Map ex) {
    // 1) جرب الحقول المعروفة في البيانات
    final raw = ex['videoId'] ?? ex['vid'] ?? ex['videoUrl'] ?? ex['v'] ?? ex['video'];
    final id = _extractVideoId(raw);
    if (id.isNotEmpty) return 'https://www.youtube.com/watch?v=$id';
    // 2) fallback: ابحث باسم التمرين في جدول الـ IDs
    final name = (ex['n'] ?? ex['name'] ?? ex['ex'] ?? '').toString().trim();
    final mappedId = _vidMap[name];
    if (mappedId != null && mappedId.isNotEmpty) {
      return 'https://www.youtube.com/watch?v=$mappedId';
    }
    return '';
  }

  // --- day name cleaning ---------------------------------------------------

  /// يحذف أي تفاصيل عضلية أو وصف بعد اسم اليوم الأساسي.
  /// مثال: "Push — صدر وترايسبس وأكتاف" ← "Push"
  /// مثال: "السبت - Push (صدر)" ← "السبت_Push"
  static String _cleanDayName(String name) {
    var s = name.trim();
    // حذف كل ما بعد قوس مفتوح (تفاصيل عضلات)
    final parenIdx = s.indexOf('(');
    if (parenIdx > 0) s = s.substring(0, parenIdx).trim();
    // استبدال الفواصل الشائعة بـ underscore لو في كلمتين
    for (final sep in [' — ', ' – ', ' - ', ' / ', ' | ']) {
      final i = s.indexOf(sep);
      if (i > 0) {
        final before = s.substring(0, i).trim();
        final after = s.substring(i + sep.length).trim();
        if (before.isNotEmpty && after.isNotEmpty) {
          s = '\${before}_\${after}';
        } else {
          s = before.isNotEmpty ? before : after;
        }
        break;
      }
    }
    return s.trim();
  }

  // --- goal label ----------------------------------------------------------

  static String _goalLabel(String? goal) {
    switch (goal) {
      case 'lose': return 'خسارة دهون';
      case 'gain': return 'بناء عضلات';
      case 'strength': return 'قوة';
      case 'fitness': return 'لياقة';
      case 'maintain': return 'ثبات';
      default: return goal ?? '—';
    }
  }

  // --- logo (real project logo, embedded as base64 PNG) -------------------
  /// لوجو الفورمة الحقيقي — مضمّن كـ base64 حتى يعمل بدون إنترنت أو ملف خارجي.
  static const String _logoB64 = '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Hz+6+ti9Pf/a/oeGP+35S+fPPn2p7uYtz9RdXrui/6xDL7Yv3PNS6+xDr3dMO/xG+8xjb7YtrH2/++w9L9Uvq17ddUv5muZfb32h7NGPny97Z+MTx3fv/lntUNm2Fqx6fjtef2Y1XvnlJmx88gg2/HU/3v/zbnz4xH68+/dG/PlBJz58bC8qd7Vh76oqfPZ+NbZu24a3XnsP6/+xD6tfWY33V76PDz74AO+++y527Njxby05OFHLX3Ph+I5efHxnNV795X6s/MtxfPDAUbzx90/w+qPb8e4fj+Ol3+zHuw8fx6pHavDh/Yfwyq/24On7NuL1h3fijd/uwYq/VcDvFb/58w9RUBsda2+hGoyKioqKajAqKiqqwaioqKgGo6KioqIajIqKimowKioqqsGoqKioqAajoqKiGoyKiopqMCoqKiqqwaioqKgGo6KiohqMioqKimowKioqqsGoqKioBqOioqKiGoyKiopqMCoqKiqqwaioqKgGo6KiohqMioqKimowKioqqsGoqKioBqOioqKiGoyKiopqMCoqKqrBqKioqKgGo6KiohqMioqKajAqKioqqsGoqKioBqOioqIajIqKiopqMCoqKqrBqKioqAajoqKiohqMioqKajAqKiqqwaioqKioBqOioqIajIqKimowKioqKqrBqKioqAajoqKiGoyKioqKajAqKiqqwaioqKioBqOiovLd8v8GAMg5/ByMWhD+AAAAAElFTkSuQmCC';

  // --- shared HTML wrapper -------------------------------------------------

  /// القالب المشترك لكلا الملفَين (تمرين وتغذية).
  /// يتضمن: لوجو + اسم التطبيق + بيانات المتدرب + تاريخ الإصدار.
  static String _wrap({
    required String title,
    required String trainee,
    required String subtitle,
    required String bodyHtml,
    String height = '',
    String weight = '',
    String age = '',
    String goal = '',
    String planType = 'workout', // workout | nutrition
  }) {
    final accentColor = planType == 'nutrition' ? '#38E1B0' : '#FF7A59';
    final accentLight = planType == 'nutrition' ? 'rgba(56,225,176,.15)' : 'rgba(255,122,89,.15)';

    // بناء صفوف بيانات المتدرب
    final metaRows = StringBuffer();
    metaRows.write('<div class="tc-item"><span class="tc-label">المتدرب</span>'
        '<span class="meta-val">${_esc(trainee.isEmpty ? 'متدرب $_brand' : trainee)}</span></div>');
    metaRows.write('<div class="tc-item"><span class="tc-label">تاريخ الإصدار</span>'
        '<span class="meta-val">${_today()}</span></div>');
    if (height.isNotEmpty && height != '0')
      metaRows.write('<div class="tc-item"><span class="tc-label">الطول</span>'
          '<span class="meta-val">${_esc(height)} سم</span></div>');
    if (weight.isNotEmpty && weight != '0')
      metaRows.write('<div class="tc-item"><span class="tc-label">الوزن</span>'
          '<span class="meta-val">${_esc(weight)} كجم</span></div>');
    if (age.isNotEmpty && age != '0')
      metaRows.write('<div class="tc-item"><span class="tc-label">العمر</span>'
          '<span class="meta-val">${_esc(age)} سنة</span></div>');
    if (goal.isNotEmpty)
      metaRows.write('<div class="tc-item"><span class="tc-label">الهدف</span>'
          '<span class="meta-val">${_esc(goal)}</span></div>');

    return '''<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>$_brandEn — ${_esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
  :root {
    --bg:       #05080f;
    --surface:  #0c1220;
    --surface2: #111927;
    --border:   rgba(255,255,255,.07);
    --txt:      #F0F6FF;
    --muted:    #7A90B5;
    --accent:   $accentColor;
    --accent-d: ${planType == 'nutrition' ? '#28B88A' : '#E05A35'};
    --accent-bg:$accentLight;
    --gold:     #FFD166;
    --radius:   18px;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body {
    font-family: 'Cairo', -apple-system, sans-serif;
    background: var(--bg);
    color: var(--txt);
    font-size: 14px;
    line-height: 1.6;
    -webkit-text-size-adjust: 100%;
    padding: 18px 12px 50px;
  }

  /* ── SHELL ── */
  .shell {
    max-width: 720px;
    margin: 0 auto;
    border-radius: 24px;
    overflow: hidden;
    border: 1px solid var(--border);
    background: var(--surface);
    box-shadow: 0 32px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.04);
  }

  /* ── HEADER ── */
  .hdr {
    position: relative;
    padding: 28px 26px 24px;
    overflow: hidden;
    display: flex;
    align-items: center;
    gap: 18px;
    border-bottom: 1px solid var(--border);
  }
  .hdr::before {
    content: '';
    position: absolute; inset: 0;
    background: radial-gradient(ellipse 80% 100% at 70% -10%, var(--accent-bg), transparent 65%);
    pointer-events: none;
  }
  .hdr-logo img { height: 72px; width: auto; display: block; filter: drop-shadow(0 4px 12px rgba(0,0,0,.4)); }
  .hdr-text { flex: 1; position: relative; }
  .hdr-brand {
    font-size: 22px;
    font-weight: 900;
    color: var(--txt);
    letter-spacing: -.4px;
    line-height: 1.1;
  }
  .hdr-sub {
    margin-top: 3px;
    font-size: 10.5px;
    font-weight: 600;
    color: var(--muted);
    letter-spacing: 2.5px;
    text-transform: uppercase;
    font-family: 'Inter', sans-serif;
  }
  .hdr-badge {
    position: relative;
    background: linear-gradient(135deg, var(--accent), var(--accent-d));
    color: #03160E;
    padding: 7px 16px;
    border-radius: 999px;
    font-size: 11.5px;
    font-weight: 900;
    letter-spacing: .4px;
    white-space: nowrap;
    box-shadow: 0 4px 14px rgba(0,0,0,.3);
    font-family: 'Cairo', sans-serif;
  }

  /* ── TRAINEE CARD ── */
  .trainee-card {
    margin: 20px 20px 0;
    padding: 18px 20px;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 16px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 14px 20px;
  }
  .tc-item { display: flex; flex-direction: column; gap: 3px; }
  .tc-label {
    font-size: 9.5px;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 1.2px;
    font-family: 'Inter', sans-serif;
  }
  .tc-val {
    font-size: 14px;
    font-weight: 800;
    color: var(--txt);
  }
  .tc-val.accent { color: var(--accent); }

  /* ── SECTION TITLE ── */
  .sec-title {
    padding: 22px 22px 6px;
    font-size: 18px;
    font-weight: 900;
    color: var(--txt);
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .sec-title::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }
  .sec-sub {
    padding: 0 22px 16px;
    font-size: 12.5px;
    color: var(--muted);
  }

  /* ── DAY CARD ── */
  .day-card {
    margin: 0 18px 14px;
    border-radius: 16px;
    overflow: hidden;
    border: 1px solid var(--border);
    background: var(--surface2);
    transition: box-shadow .2s;
  }
  .day-hdr {
    padding: 14px 18px;
    display: flex;
    align-items: center;
    gap: 12px;
    background: linear-gradient(90deg, var(--accent-bg), transparent);
    border-bottom: 1px solid var(--border);
  }
  .day-num-badge {
    width: 32px; height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--accent), var(--accent-d));
    color: #03160E;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px;
    font-weight: 900;
    flex-shrink: 0;
    box-shadow: 0 3px 10px rgba(0,0,0,.3);
    font-family: 'Inter', sans-serif;
  }
  .day-label {
    font-size: 14.5px;
    font-weight: 900;
    color: var(--txt);
    flex: 1;
  }
  .day-tag {
    background: var(--accent-bg);
    border: 1px solid rgba(255,255,255,.08);
    color: var(--accent);
    font-size: 10.5px;
    font-weight: 800;
    padding: 3px 10px;
    border-radius: 999px;
    font-family: 'Inter', sans-serif;
  }

  /* Rest day */
  .day-card.rest .day-hdr {
    background: linear-gradient(90deg, rgba(255,122,89,.08), transparent);
  }
  .day-card.rest .day-tag { background: rgba(255,122,89,.12); color: #FF9C7A; }
  .rest-body {
    padding: 16px 18px;
    color: #FFC9B8;
    font-size: 13.5px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .rest-icon {
    font-size: 20px;
  }

  /* ── EXERCISE TABLE ── */
  .ex-table { width: 100%; border-collapse: collapse; }
  .ex-table thead tr { border-bottom: 1px solid var(--border); }
  .ex-table th {
    text-align: right;
    padding: 10px 16px;
    font-size: 10px;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    font-family: 'Inter', sans-serif;
  }
  .ex-table td {
    text-align: right;
    padding: 13px 16px;
    font-size: 13px;
    border-bottom: 1px solid rgba(255,255,255,.04);
    vertical-align: middle;
  }
  .ex-table tr:last-child td { border-bottom: none; }
  .ex-table tbody tr:hover td { background: rgba(255,255,255,.02); }
  .ex-name { font-weight: 800; color: var(--txt); font-size: 13.5px; }
  .ex-muscle {
    font-size: 11px;
    color: var(--muted);
    margin-top: 3px;
    font-weight: 500;
  }
  .ex-val {
    color: var(--accent);
    font-weight: 900;
    font-size: 14px;
    font-family: 'Inter', sans-serif;
  }
  .vid-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: var(--accent-bg);
    color: var(--accent);
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 8px;
    padding: 5px 11px;
    font-size: 11px;
    font-weight: 700;
    text-decoration: none;
    white-space: nowrap;
    font-family: 'Inter', sans-serif;
  }
  .vid-btn:hover { opacity: .8; }
  .vid-none { color: var(--muted); font-size: 11px; }

  /* ── MEAL CARD ── */
  .meal-card {
    margin: 0 18px 14px;
    border-radius: 16px;
    overflow: hidden;
    border: 1px solid var(--border);
    background: var(--surface2);
  }
  .meal-hdr {
    padding: 14px 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: linear-gradient(90deg, var(--accent-bg), transparent);
    border-bottom: 1px solid var(--border);
  }
  .meal-name { font-size: 14.5px; font-weight: 900; }
  .meal-cal-badge {
    background: var(--accent-bg);
    border: 1px solid rgba(255,255,255,.1);
    color: var(--accent);
    font-size: 11.5px;
    font-weight: 900;
    padding: 4px 12px;
    border-radius: 999px;
    font-family: 'Inter', sans-serif;
  }
  .food-table { width: 100%; border-collapse: collapse; }
  .food-table th {
    text-align: right;
    padding: 9px 16px;
    font-size: 10px;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    border-bottom: 1px solid var(--border);
    font-family: 'Inter', sans-serif;
  }
  .food-table td {
    text-align: right;
    padding: 11px 16px;
    font-size: 13px;
    border-bottom: 1px solid rgba(255,255,255,.04);
  }
  .food-table tr:last-child td { border-bottom: none; }
  .food-name { font-weight: 700; }
  .macro-row {
    display: flex;
    gap: 8px;
    padding: 10px 16px 14px;
    flex-wrap: wrap;
    border-top: 1px solid var(--border);
  }
  .chip {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 5px 12px;
    font-size: 11.5px;
    font-weight: 800;
    font-family: 'Inter', sans-serif;
  }
  .chip.pro  { color: #38E1B0; border-color: rgba(56,225,176,.2); }
  .chip.carb { color: #FFD166; border-color: rgba(255,209,102,.2); }
  .chip.fat  { color: #FF9C7A; border-color: rgba(255,156,122,.2); }

  /* ── TOTALS BAR ── */
  .totals-bar {
    margin: 14px 18px 6px;
    padding: 14px 18px;
    background: linear-gradient(90deg, var(--accent-bg), transparent);
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 14px;
    display: flex;
    flex-wrap: wrap;
    gap: 12px 24px;
    font-size: 13.5px;
    font-weight: 900;
    color: var(--accent);
    font-family: 'Inter', sans-serif;
  }
  .totals-bar span { color: var(--muted); font-weight: 600; font-size: 12px; display: block; }

  /* ── DIVIDER ── */
  .divider { height: 1px; background: var(--border); margin: 8px 18px; }

  /* ── FOOTER ── */
  .footer {
    margin-top: 24px;
    padding: 18px 24px;
    border-top: 1px solid var(--border);
    text-align: center;
    font-size: 12px;
    color: var(--muted);
    line-height: 1.8;
  }
  .footer strong { color: var(--accent); font-weight: 800; }
  .footer-logo {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  /* ── PRINT ── */
  @media print {
    body { background: #fff; color: #111; padding: 0; }
    .shell { box-shadow: none; border: none; border-radius: 0; background: #fff; }
    .hdr { background: #f4f4f4; }
    .trainee-card, .day-card, .meal-card { background: #fafafa; border-color: #e0e0e0; }
    .hdr::before { display: none; }
    .vid-btn { color: var(--accent-d); border-color: var(--accent-d); background: transparent; }
  }

  /* ── RESPONSIVE ── */
  @media (max-width: 520px) {
    body { padding: 10px 8px 40px; }
    .shell { border-radius: 18px; }
    .hdr { padding: 20px 16px 18px; gap: 12px; }
    .hdr-logo img { height: 56px; }
    .hdr-brand { font-size: 18px; }
    .trainee-card { margin: 14px 14px 0; grid-template-columns: 1fr 1fr; padding: 14px 16px; }
    .sec-title { padding: 16px 16px 4px; font-size: 16px; }
    .sec-sub { padding: 0 16px 12px; }
    .day-card, .meal-card { margin: 0 12px 12px; border-radius: 14px; }
    .day-hdr, .meal-hdr { padding: 12px 14px; }
    .ex-table th, .ex-table td { padding: 10px 12px; }
    .ex-table th { font-size: 9px; }
    .food-table th, .food-table td { padding: 9px 12px; }
    .totals-bar { margin: 10px 12px 4px; }
    .footer { padding: 14px 16px; }
    .hdr-badge { display: none; }
    .day-tag { display: none; }
  }
</style>
</head>
<body>
<div class="shell">

  <!-- Header -->
  <div class="hdr">
    <div class="hdr-logo"><img src="data:image/png;base64,$_logoB64" alt="ElForma"></div>
    <div class="hdr-text">
      <div class="hdr-brand">$_brand</div>
      <div class="hdr-sub">$_brandEn · Official Plan</div>
    </div>
    <div class="hdr-badge">✦ نسخة رسمية</div>
  </div>

  <!-- Trainee info -->
  <div class="trainee-card">
    $metaRows
  </div>

  <!-- Title -->
  <div class="sec-title">${_esc(title)}</div>
  <div class="sec-sub">${_esc(subtitle)}</div>

  $bodyHtml

  <div class="footer">
    <div class="footer-logo">
      <img src="data:image/png;base64,$_logoB64" alt="" style="height:24px;opacity:.6">
      <strong>$_brand</strong>
    </div>
    خطتك الشخصية — صُممت لك بواسطة <strong>$_brandEn</strong>
  </div>

</div>
</body>
</html>''';
  }

  // --- workout HTML --------------------------------------------------------

  /// يبني مستند HTML احترافي لخطة التمرين.
  /// [r]: رد السيرفر من /api/workout/compute
  /// [profile]: بيانات المتدرب من ProfileStore
  static String workoutHtml(
    Map<String, dynamic> r, {
    String trainee = '',
    Map<String, dynamic>? profile,
  }) {
    final p = profile ?? const <String, dynamic>{};
    final metrics = (r['metrics'] as Map?)?.cast<String, dynamic>() ?? {};
    final cals = metrics['targetCals'] ?? metrics['tdee'];
    final plans = (r['plans'] as List?) ?? const [];

    // الخطة المختارة: المُوصى بها أو الأولى
    final chosen = plans.whereType<Map>().isNotEmpty
        ? Map<String, dynamic>.from(plans.whereType<Map>().firstWhere(
            (p) => p['rec'] == true,
            orElse: () => plans.whereType<Map>().first))
        : <String, dynamic>{};
    final planName = (chosen['name'] ?? 'خطة التمرين').toString();

    // نجيب أيام الجدول — المحرك بيخزنهم في plan أو trainDays
    final week = (chosen['plan'] as List?) ??
        (chosen['trainDays'] as List?) ??
        const [];

    final buf = StringBuffer();

    // شريط السعرات
    if (cals != null) {
      buf.write('<div class="totals-bar">'
          'السعرات المستهدفة: <span>\${_esc(cals)} سعرة / يوم</span>'
          '</div>');
    }

    if (week.isEmpty) {
      buf.write('<p style="padding:20px 22px;color:var(--muted);">'
          'لا توجد أيام تمرين محفوظة في هذه الخطة.</p>');
    }

    var dayIndex = 0;
    for (final day in week.whereType<Map>()) {
      dayIndex++;
      final rawName = (day['name'] ?? day['day'] ?? 'يوم $dayIndex').toString();
      final cleanName = _cleanDayName(rawName);

      // التمارين: نجرب كل الحقول الممكنة
      final items = (day['exercises'] as List?) ??
          (day['items'] as List?) ??
          (day['lifts'] as List?) ??
          const [];

      final isRest = items.isEmpty ||
          day['isRest'] == true ||
          RegExp(r'راحة|تعافي|rest|recovery', caseSensitive: false).hasMatch(rawName);

      if (isRest) {
        buf.write('<div class="day-card rest">'
            '<div class="day-header">'
            '<span class="day-num">$dayIndex</span>'
            '${_esc(cleanName)}'
            '</div>'
            '<div class="rest-body">'
            'يوم راحة واستشفاء — اشرب مية كويس ونام كفاية عشان العضلة تبني وتتقوى.'
            '</div></div>');
        continue;
      }

      buf.write('<div class="day-card">'
          '<div class="day-header">'
          '<span class="day-num">$dayIndex</span>'
          '${_esc(cleanName)}'
          '</div>'
          '<table class="ex-table">'
          '<thead><tr>'
          '<th>التمرين</th>'
          '<th>مجموعات</th>'
          '<th>تكرار</th>'
          '<th>فيديو الأداء</th>'
          '</tr></thead>'
          '<tbody>');

      var exIndex = 0;
      for (final ex in items.whereType<Map>()) {
        exIndex++;
        // اسم التمرين: n ثم name ثم ex (ترتيب engine_contracts)
        final exName = (ex['n'] ?? ex['name'] ?? ex['ex'] ?? 'تمرين $exIndex').toString().trim();
        final muscle = (ex['mu'] ?? ex['muscle'] ?? '').toString().trim();
        final sets = (ex['sets'] ?? '').toString().trim();
        final reps = (ex['reps'] ?? '').toString().trim();

        // رابط الفيديو الحقيقي من الداتا
        final videoUrl = _buildVideoUrl(ex);
        final vidCell = videoUrl.isNotEmpty
            ? '<a class="vid-btn" href="${_esc(videoUrl)}" target="_blank">'
                '▶ شاهد الأداء</a>'
            : '<span class="vid-none">—</span>';

        buf.write('<tr>'
            '<td><div class="ex-name">${_esc(exName)}</div>'
            '${muscle.isNotEmpty ? '<div class="ex-muscle">${_esc(muscle)}</div>' : ''}</td>'
            '<td class="ex-num">${sets.isEmpty ? "—" : _esc(sets)}</td>'
            '<td class="ex-num">${reps.isEmpty ? "—" : _esc(reps)}</td>'
            '<td>$vidCell</td>'
            '</tr>');
      }

      buf.write('</tbody></table></div>');
    }

    return _wrap(
      title: 'خطة التمرين',
      trainee: trainee,
      subtitle: planName,
      bodyHtml: buf.toString(),
      height: '${p['height'] ?? ''}',
      weight: '${p['weight'] ?? ''}',
      age: '${p['age'] ?? ''}',
      goal: _goalLabel(p['goal']?.toString()),
      planType: 'workout',
    );
  }

  // --- nutrition HTML ------------------------------------------------------

  /// يبني مستند HTML احترافي لخطة التغذية.
  /// [meals]: كل وجبة: {name, cals?, macros?{pro,carb,fat}, foods:[{name,grams,cals,pro?,carb?,fat?}]}
  static String nutritionHtml({
    required List<Map<String, dynamic>> meals,
    required String dayLabel,
    num targetCalories = 0,
    num targetProtein = 0,
    num targetCarbs = 0,
    num targetFat = 0,
    String trainee = '',
    String notes = '',
    Map<String, dynamic>? profile,
  }) {
    final p = profile ?? const <String, dynamic>{};
    final buf = StringBuffer();

    // شريط الأهداف اليومية
    if (targetCalories > 0) {
      buf.write('<div class="totals-bar">');
      buf.write('السعرات المستهدفة: <span>${targetCalories.round()} سعرة / يوم</span>');
      if (targetProtein > 0)
        buf.write(' &nbsp;|&nbsp; بروتين: <span>${targetProtein.round()} جم</span>');
      if (targetCarbs > 0)
        buf.write(' &nbsp;|&nbsp; كارب: <span>${targetCarbs.round()} جم</span>');
      if (targetFat > 0)
        buf.write(' &nbsp;|&nbsp; دهون: <span>${targetFat.round()} جم</span>');
      buf.write('</div>');
    }

    if (meals.isEmpty) {
      buf.write('<p style="padding:20px 22px;color:var(--muted);">'
          'لا توجد وجبات محفوظة لهذا اليوم.</p>');
    }

    var mealIndex = 0;
    for (final meal in meals) {
      mealIndex++;
      final mealName = (meal['name'] ?? 'وجبة $mealIndex').toString();
      final mealCals = meal['cals'] ?? meal['calories'] ?? meal['kcal'];
      final foods = (meal['foods'] as List?) ?? const [];
      final macros = (meal['macros'] as Map?) ?? const {};

      // حساب سعرات الوجبة لو مش محسوبة
      num computedCals = (mealCals is num) ? mealCals : 0;
      if (computedCals == 0) {
        for (final f in foods.whereType<Map>()) {
          final c = f['cals'] ?? f['calories'] ?? f['kcal'];
          if (c is num) computedCals += c;
        }
      }

      final calsLabel = computedCals > 0 ? '${computedCals.round()} سعرة' : '';

      buf.write('<div class="meal-card">'
          '<div class="meal-header">'
          '<div class="meal-name">${_esc(mealName)}</div>'
          '${calsLabel.isNotEmpty ? '<div class="meal-cals">$calsLabel</div>' : ''}'
          '</div>');

      if (foods.isNotEmpty) {
        buf.write('<table class="food-table">'
            '<thead><tr>'
            '<th>الصنف</th><th>الكمية (جم)</th><th>سعرات</th>'
            '</tr></thead><tbody>');
        for (final f in foods.whereType<Map>()) {
          final fn = (f['name'] ?? f['food'] ?? 'صنف').toString();
          final g = f['grams'] ?? f['g'] ?? f['amount'];
          final c = f['cals'] ?? f['calories'] ?? f['kcal'];
          final gStr = (g == null) ? '—' : '${(g is num) ? g.round() : g}';
          final cStr = (c == null) ? '—' : '${(c is num) ? c.round() : c}';
          buf.write('<tr>'
              '<td class="food-name">${_esc(fn)}</td>'
              '<td>$gStr</td>'
              '<td>$cStr</td>'
              '</tr>');
        }
        buf.write('</tbody></table>');
      }

      // مؤشرات المكروز للوجبة
      final pro = macros['pro'] ?? macros['protein'];
      final carb = macros['carb'] ?? macros['carbs'];
      final fat = macros['fat'];
      if (pro != null || carb != null || fat != null) {
        buf.write('<div class="macro-row">');
        if (pro != null)
          buf.write('<span class="macro-chip pro">🥩 بروتين: ${(pro is num) ? pro.round() : pro} جم</span>');
        if (carb != null)
          buf.write('<span class="macro-chip carb">🌾 كارب: ${(carb is num) ? carb.round() : carb} جم</span>');
        if (fat != null)
          buf.write('<span class="macro-chip fat">🥑 دهون: ${(fat is num) ? fat.round() : fat} جم</span>');
        buf.write('</div>');
      }

      buf.write('</div>'); // meal-card
    }

    if (notes.trim().isNotEmpty) {
      buf.write('<p style="padding:10px 22px 4px;color:var(--muted);font-size:12.5px;">'
          '<strong>ملاحظات:</strong> ${_esc(notes)}</p>');
    }

    return _wrap(
      title: 'خطة التغذية',
      trainee: trainee,
      subtitle: dayLabel,
      bodyHtml: buf.toString(),
      height: '${p['height'] ?? ''}',
      weight: '${p['weight'] ?? ''}',
      age: '${p['age'] ?? ''}',
      goal: _goalLabel(p['goal']?.toString()),
      planType: 'nutrition',
    );
  }

  // --- download ------------------------------------------------------------

  /// يكتب المستند كملف HTML حقيقي ويفتح شيت المشاركة/الحفظ.
  static Future<void> download({
    required String html,
    required String baseName,
    String shareText = '',
  }) async {
    final dir = await getTemporaryDirectory();
    final stamp = DateTime.now().millisecondsSinceEpoch;
    final file = File('${dir.path}/$baseName-$stamp.html');
    await file.writeAsString(html, flush: true);
    await Share.shareXFiles(
      [XFile(file.path, mimeType: 'text/html')],
      text: shareText.isEmpty ? 'نسخة رسمية من $_brand' : shareText,
    );
  }
}
