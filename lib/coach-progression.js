'use strict';
/* ElForma - Smart Coach progression, ported for the mobile app.
 *
 * WHY THIS FILE EXISTS
 * The website's progression brain lives in app/workout/ui/coach.js. That file is
 * a browser module: it keeps its per-lift state in localStorage and it is NEVER
 * loaded by the app's engine host. So the app had the training PLAN but not the
 * thinking that EVOLVES it: no double progression, no RIR waving across the
 * mesocycle, no stall handling, no e1RM personal records, no tonnage, no ACWR.
 *
 * Every equation below is a verbatim port from app/workout/ui/coach.js
 * (incFor / range / MRV / MEV / rirFor / tonnage / e1rm / pct1rm / stimReps /
 *  mav / volStatus / acwrFrom / acwrZone / e1rmTrend / nextTarget / applyDay).
 * Nothing here is invented.
 *
 * ONE DELIBERATE DIFFERENCE, and it is an improvement, not a drift:
 * the website derives a lift's working weight from localStorage state that only
 * exists in the browser that logged it. The app has the real set log in SQLite,
 * so replayLift() REPLAYS the logged sessions through the identical double
 * progression rules to reconstruct the same state (ww / rep / stall / prog /
 * bestE1). Same rules, same numbers, but durable and per-user across devices.
 */

/* ---- exercise classification (coach.js:28-30) ---- */
const BIG = /(squat|deadlift|bench|press|row|pull[- ]?up|chin|\u0633\u0643\u0648\u0627\u062a|\u062f\u064a\u062f\u0644\u064a\u0641\u062a|\u0628\u0646\u0634|\u0636\u063a\u0637|\u062a\u062c\u062f\u064a\u0641|\u0645\u0643\u0628\u0633|\u0639\u0642\u0644\u0629|\u0633\u062d\u0628|\u0647\u064a\u0628 \u062b\u0631\u0627\u0633\u062a|hip thrust)/i;
const ISO = /(curl|fly|raise|lateral|extension|pushdown|kickback|\u0628\u0627\u064a\u0633\u0628\u0633|\u062a\u0631\u0627\u064a\u0633\u0628\u0633|\u0631\u0641\u0631\u0641\u0629|\u062a\u0641\u062a\u064a\u062d|\u062a\u0645\u062f\u064a\u062f|\u0633\u0645\u0627\u0646\u0629|calf)/i;

/** Load increment for a lift: 5 kg compound, 1.25 kg isolation, 2.5 kg else. */
function incFor(name) {
  if (BIG.test(name || '')) return 5;
  if (ISO.test(name || '')) return 1.25;
  return 2.5;
}

/** Parse a prescribed rep range like "8-12" into [lo, hi]. */
function range(reps) {
  const m = String(reps || '').match(/(\d+)\s*-\s*(\d+)/);
  if (m) return [+m[1], +m[2]];
  const n = parseInt(reps, 10) || 10;
  return [Math.max(1, n - 3), n];
}

/** Top of the rep range - the trigger for a load increase. */
function topRep(reps) { return range(reps)[1]; }

function round(n, step) {
  step = step || 0.5;
  return Math.round(n / step) * step;
}

/* ---- weekly volume landmarks, Renaissance Periodization (coach.js:34-45) ---- */
const MRV = {
  beginner: { def: 12, chest: 12, back: 14, legs: 14, quads: 14, hamstrings: 12, glutes: 12, shoulders: 12, arms: 10, core: 12, calves: 10, forearms: 8 },
  intermediate: { def: 16, chest: 18, back: 20, legs: 18, quads: 18, hamstrings: 14, glutes: 16, shoulders: 16, arms: 16, core: 14, calves: 14, forearms: 12 },
  advanced: { def: 20, chest: 22, back: 24, legs: 22, quads: 22, hamstrings: 18, glutes: 18, shoulders: 20, arms: 20, core: 16, calves: 18, forearms: 14 }
};
const MEV = {
  beginner: { def: 6, chest: 6, back: 8, quads: 6, hamstrings: 4, glutes: 4, shoulders: 6, arms: 4, core: 6, calves: 6, forearms: 4 },
  intermediate: { def: 8, chest: 8, back: 10, quads: 8, hamstrings: 6, glutes: 6, shoulders: 8, arms: 6, core: 8, calves: 8, forearms: 6 },
  advanced: { def: 10, chest: 10, back: 10, quads: 8, hamstrings: 6, glutes: 6, shoulders: 8, arms: 8, core: 8, calves: 8, forearms: 6 }
};
function mrv(exp, m) { const t = MRV[exp] || MRV.intermediate; return t[m] || t.def; }
function mev(exp, m) { const t = MEV[exp] || MEV.intermediate; return t[m] || t.def; }
/** Maximum Adaptive Volume = productive midpoint between MEV and MRV. */
function mav(exp, m) { return Math.round((mev(exp, m) + mrv(exp, m)) / 2); }

/** Weekly-volume status for a muscle vs its landmarks (coach.js:512-517). */
function volStatus(exp, m, sets) {
  const lo = mev(exp, m), mid = mav(exp, m), hi = mrv(exp, m);
  if (sets < lo) return { z: 'below', lo, mid, hi, txt: '\u062a\u062d\u062a MEV (' + lo + ') \u2014 \u062d\u062c\u0645 \u063a\u064a\u0631 \u0643\u0627\u0641 \u0644\u0644\u0646\u0645\u0648' };
  if (sets < mid) return { z: 'build', lo, mid, hi, txt: '\u0641\u064a \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0628\u0646\u0627\u0621 (' + lo + '\u2013' + mid + ') \u2014 \u0641\u064a\u0647 \u0645\u0633\u0627\u062d\u0629 \u0644\u0632\u064a\u0627\u062f\u0629 \u0627\u0644\u062d\u062c\u0645' };
  if (sets < hi) return { z: 'optimal', lo, mid, hi, txt: '\u0642\u0631\u0628 \u0627\u0644\u062d\u062c\u0645 \u0627\u0644\u0623\u0645\u062b\u0644 (' + mid + '\u2013' + hi + ') \u2014 \u0632\u0648\u062f \u0628\u062d\u0630\u0631' };
  return { z: 'over', lo, mid, hi, txt: '\u0639\u0646\u062f/\u0641\u0648\u0642 MRV (' + hi + ') \u2014 \u062e\u0637\u0631 \u0625\u0641\u0631\u0627\u0637\u060c \u0641\u0643\u0631 \u0641\u064a \u062a\u062e\u0641\u064a\u0641' };
}

/** RIR target for a mesocycle week: higher early, lower late, +1 on deload. */
function rirFor(exp, mweek, meso) {
  if (mweek >= meso) return (exp === 'advanced' ? 1 : exp === 'beginner' ? 4 : 3) + 1;
  const start = 3;
  const min = (exp === 'beginner' ? 2 : exp === 'advanced' ? 0 : 1);
  const span = Math.max(1, meso - 1);
  const t = (mweek - 1) / span;
  return Math.max(min, Math.round(start - (start - min) * t));
}

/* ---- training-science metrics (coach.js:499-533) ---- */
function tonnage(w, r, s) { return (+w || 0) * (+r || 0) * (+s || 0); }

/** Estimated 1RM (Epley) - a strength proxy independent of the rep used. */
function e1rm(w, r) {
  w = +w || 0; r = +r || 0;
  if (w <= 0 || r <= 0) return 0;
  return r === 1 ? w : Math.round(w * (1 + r / 30) * 10) / 10;
}
/** Relative intensity = %1RM implied by a rep count (inverse Epley). */
function pct1rm(r) { r = +r || 0; return r <= 1 ? 1 : 1 / (1 + r / 30); }
/** Stimulating reps in a set: the last 5 reps before failure, given target RIR. */
function stimReps(reps, rir) {
  reps = +reps || 0; rir = +rir || 0;
  return Math.max(0, Math.min(reps, 5 - rir));
}

/** Acute:Chronic Workload Ratio from tonnage history (safe band 0.8-1.3). */
function acwrFrom(hist, week) {
  const byW = {};
  (hist || []).forEach(function (h) {
    byW[h.week] = (byW[h.week] || 0) + tonnage(h.weight, h.reps, h.sets);
  });
  const acute = byW[week] || 0;
  let chron = 0, n = 0;
  for (let w = week - 1; w >= week - 4 && w >= 1; w--) {
    if (byW[w] != null) { chron += byW[w]; n++; }
  }
  chron = n ? chron / n : 0;
  return chron > 0 ? Math.round(acute / chron * 100) / 100 : null;
}
function acwrZone(a) {
  if (a == null) return '';
  if (a < 0.8) return '\u0645\u0646\u062e\u0641\u0636 (\u0627\u062d\u062a\u0645\u0627\u0644 \u0641\u0642\u062f\u0627\u0646 \u0644\u064a\u0627\u0642\u0629)';
  if (a <= 1.3) return '\u0645\u062b\u0627\u0644\u064a (\u062a\u062d\u0645\u064a\u0644 \u0622\u0645\u0646 \u0648\u0641\u0639\u0627\u0644)';
  if (a <= 1.5) return '\u0645\u0631\u062a\u0641\u0639 (\u0631\u0627\u0642\u0628 \u0627\u0644\u062a\u0639\u0628)';
  return '\u062e\u0637\u0631 \u0625\u0641\u0631\u0627\u0637 (Spike)';
}

/** e1RM trend for one exercise: first vs last estimated 1RM. */
function e1rmTrend(rows, exName) {
  let first = null, last = null, lastTs = 0, firstTs = 1e18;
  (rows || []).forEach(function (h) {
    if (exName && h.exName !== exName) return;
    const e = e1rm(h.weight, h.reps);
    if (e <= 0) return;
    const ts = +h.ts || 0;
    if (ts < firstTs) { firstTs = ts; first = e; }
    if (ts >= lastTs) { lastTs = ts; last = e; }
  });
  if (first == null || last == null) return null;
  return {
    from: first, to: last,
    delta: Math.round((last - first) * 10) / 10,
    pct: first ? Math.round((last - first) / first * 1000) / 10 : 0
  };
}

/* ---- lift state, replayed from the real log instead of localStorage ---- */
/**
 * Replay logged sessions for ONE lift through the website's double-progression
 * rules (coach.js applyDay). Sessions must be oldest-first; each session is the
 * best set of that day: { weight, reps, ts }.
 */
function replayLift(prescription, sessions) {
  const r = range(prescription && prescription.reps);
  const lo = r[0], hi = r[1];
  const inc = incFor(prescription && prescription.name);
  const st = {
    ww: 0, rep: lo, stall: 0, prog: 0, sessions: 0,
    bestE1: 0, prs: 0, lo, hi, inc, events: []
  };
  (sessions || []).forEach(function (lg) {
    const w = +lg.weight || 0;
    const reps = +lg.reps || 0;
    if (!w) return;
    st.sessions++;
    const e = e1rm(w, reps);
    if (st.ww && e > st.bestE1 + 0.01) { st.prs++; }
    if (e > st.bestE1) st.bestE1 = e;

    if (!st.ww) {
      st.ww = w;
      st.rep = Math.max(lo, Math.min(hi, reps || lo));
      st.events.push({ kind: 'base', weight: st.ww });
      return;
    }
    if (w >= st.ww) {
      if (reps >= hi) {
        st.ww = round(st.ww + inc);
        st.rep = lo;
        st.stall = 0;
        st.prog++;
        st.events.push({ kind: 'load_up', weight: st.ww });
      } else if (reps >= lo) {
        st.rep = Math.min(hi, reps + 1);
        st.stall = 0;
        st.prog++;
        st.events.push({ kind: 'rep_up', reps: st.rep });
      } else {
        st.stall++;
        if (st.stall >= 2) {
          st.ww = round(st.ww * 0.9);
          st.rep = lo;
          st.stall = 0;
          st.events.push({ kind: 'back_off', weight: st.ww });
        }
      }
    }
  });
  return st;
}

/**
 * The next session's target for one lift (coach.js nextTarget).
 * On a deload week the load drops to 90% and reps go to the bottom of the range.
 */
function nextTarget(prescription, sessions, opts) {
  opts = opts || {};
  const exp = opts.exp || 'intermediate';
  const mweek = +opts.mweek || 1;
  const meso = +opts.meso || 5;
  const st = replayLift(prescription, sessions);
  const deload = mweek >= meso;
  const w = st.ww || 0;
  return {
    weight: (deload && w) ? round(w * 0.9) : (w || null),
    reps: deload ? st.lo : st.rep,
    rir: rirFor(exp, mweek, meso),
    sets: +((prescription && prescription.sets)) || 3,
    deload: deload,
    lo: st.lo,
    hi: st.hi,
    inc: st.inc,
    hasBase: !!st.ww,
    prog: st.prog,
    stall: st.stall,
    bestE1rm: st.bestE1 || null,
    prs: st.prs,
    loggedSessions: st.sessions
  };
}

function fmt1(n) {
  const v = Math.round((+n || 0) * 10) / 10;
  return v % 1 === 0 ? String(v) : v.toFixed(1);
}

/** The coach's sentence for the next set (coach-driven branch of suggestText). */
function suggestText(prescription, sessions, opts) {
  const t = nextTarget(prescription, sessions, opts);
  if (!t.hasBase) {
    return '\u0633\u062c\u0644 \u0623\u0648\u0644 \u0648\u0632\u0646' + (t.deload ? ' (\u0623\u0633\u0628\u0648\u0639 \u062a\u062e\u0641\u064a\u0641)' : '') +
      ' \u0639\u0634\u0627\u0646 \u0645\u062f\u0631\u0628\u0643 \u0627\u0644\u0630\u0643\u064a \u064a\u0628\u062f\u0623 \u064a\u0637\u0648\u0631 \u062d\u0645\u0644\u0643';
  }
  if (t.deload) {
    return '\u0623\u0633\u0628\u0648\u0639 \u062a\u062e\u0641\u064a\u0641: ' + fmt1(t.weight) + ' \u0643\u062c\u0645 \u00d7 ' + t.reps +
      ' \u0639\u062f\u0629 \u00b7 \u062e\u0641\u064a\u0641 \u0648\u0633\u0647\u0644 (RIR ' + t.rir + ')';
  }
  return '\u0645\u0642\u062a\u0631\u062d: ' + fmt1(t.weight) + ' \u0643\u062c\u0645 \u00d7 ' + t.reps +
    ' \u0639\u062f\u0629 \u2014 \u0627\u062d\u062a\u0641\u0638 \u0628 ' + t.rir + ' \u062a\u0643\u0631\u0627\u0631 \u0641\u064a \u0627\u0644\u062e\u0632\u0627\u0646';
}

/**
 * Session science summary (the numbers coach.js prints after applyDay):
 * total tonnage, sets, stimulating reps, and e1RM personal records.
 */
function sessionSummary(lifts, opts) {
  opts = opts || {};
  const rirT = rirFor(opts.exp || 'intermediate', +opts.mweek || 1, +opts.meso || 5);
  let ton = 0, stim = 0, sets = 0, n = 0, prs = 0, topInt = 0, topName = '';
  (lifts || []).forEach(function (l) {
    const w = +l.weight || 0, reps = +l.reps || 0, s = +l.sets || 0;
    if (!w) return;
    n++; sets += s;
    ton += tonnage(w, reps, s);
    stim += stimReps(reps, rirT) * s;
    if (l.isPr) prs++;
    const ri = pct1rm(reps);
    if (ri > topInt) { topInt = ri; topName = l.name || ''; }
  });
  return {
    lifts: n,
    sets: sets,
    tonnage: Math.round(ton),
    stimulatingReps: Math.round(stim),
    targetRir: rirT,
    personalRecords: prs,
    topIntensityExercise: topName || null,
    topIntensityPct: topName ? Math.round(topInt * 100) : null
  };
}

module.exports = {
  BIG, ISO, MRV, MEV,
  incFor, range, topRep, round,
  mrv, mev, mav, volStatus, rirFor,
  tonnage, e1rm, pct1rm, stimReps,
  acwrFrom, acwrZone, e1rmTrend,
  replayLift, nextTarget, suggestText, sessionSummary, fmt1
};
