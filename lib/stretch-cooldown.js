'use strict';
// lib/stretch-cooldown.js
//
// Guided cool-down stretches, organised exactly like the guided warm-up
// (lib/warmup-activation.js): same shape, same rules, same rendering contract.
//
// HARD RULE: this file NEVER stores a video id of its own. It reads the same
// engine database the website serves (app/workout/engine/db.js) and returns the
// ids authored there. A move with no authored video is returned without one -
// we never substitute and never guess.
//
// OWNER RULE: not every stretch belongs after every session. The stretches are
// picked from the muscles the session actually trained, so a chest day never
// ends with a calf stretch.

const warmup = require('./warmup-activation');

const MAX_MOVES = 4;

// Muscle group -> the authored static stretches that actually serve it.
// Order inside each list is priority order (most important first).
const BY_GROUP = {
  chest:       ['Doorway Chest Stretch'],
  shoulders:   ['Cross Body Shoulder Stretch', 'Doorway Chest Stretch'],
  front_delt:  ['Doorway Chest Stretch'],
  side_delt:   ['Cross Body Shoulder Stretch'],
  rear_delt:   ['Cross Body Shoulder Stretch'],
  delts:       ['Cross Body Shoulder Stretch'],
  triceps:     ['Lat Stretch (Overhead)'],
  back:        ["Child's Pose Lower Back", 'Lat Stretch (Overhead)'],
  lats:        ['Lat Stretch (Overhead)', "Child's Pose Lower Back"],
  traps:       ['Cross Body Shoulder Stretch'],
  biceps:      ['Doorway Chest Stretch'],
  forearms:    ['Cross Body Shoulder Stretch'],
  quads:       ['Quad Stretch Standing', 'Hip Flexor Lunge Stretch'],
  hamstrings:  ['Hamstring Stretch (Seated)', 'Glute Figure-4 Stretch'],
  glutes:      ['Glute Figure-4 Stretch', 'Hamstring Stretch (Seated)'],
  calves:      ['Calf Wall Stretch'],
  adductors:   ['Glute Figure-4 Stretch'],
  abductors:   ['Glute Figure-4 Stretch'],
  abs:         ["Child's Pose Lower Back", 'Hip Flexor Lunge Stretch'],
  core:        ["Child's Pose Lower Back", 'Hip Flexor Lunge Stretch'],
  obliques:    ["Child's Pose Lower Back"]
};

// Fallback when the day carries no usable group data.
const BY_PATTERN = {
  push: ['Doorway Chest Stretch', 'Cross Body Shoulder Stretch', 'Lat Stretch (Overhead)'],
  pull: ["Child's Pose Lower Back", 'Lat Stretch (Overhead)', 'Cross Body Shoulder Stretch'],
  legs: ['Hamstring Stretch (Seated)', 'Quad Stretch Standing', 'Glute Figure-4 Stretch', 'Calf Wall Stretch'],
  core: ["Child's Pose Lower Back", 'Hip Flexor Lunge Stretch'],
  full: ['Hamstring Stretch (Seated)', 'Doorway Chest Stretch', 'Hip Flexor Lunge Stretch', "Child's Pose Lower Back"]
};

function pool() {
  const db = warmup.moduleDb();
  return (db && Array.isArray(db.stretching)) ? db.stretching : [];
}

function toMove(hit) {
  const vid = (hit && typeof hit.vid === 'string' && hit.vid.trim()) ? hit.vid.trim() : '';
  const bits = [];
  if (hit && hit.duration) bits.push(String(hit.duration));
  if (hit && hit.target) bits.push(String(hit.target));
  return {
    name: String(hit && hit.n),
    detail: bits.join('  -  '),
    videoId: vid,
    hasVideo: !!vid
  };
}

// Which authored names this session deserves, in priority order.
function wantedNames(groups) {
  const g = warmup.normalizeGroups(groups);
  const out = [];
  const seen = {};
  g.forEach(function (name) {
    (BY_GROUP[name] || []).forEach(function (stretchName) {
      if (seen[stretchName]) return;
      seen[stretchName] = 1;
      out.push(stretchName);
    });
  });
  if (out.length) return out;
  return (BY_PATTERN[warmup.patternFor(groups)] || BY_PATTERN.full).slice();
}

// Returns [{ name, detail, videoId, hasVideo }] - at most MAX_MOVES moves,
// chosen for the muscles this session actually trained.
function cooldownFor(groups) {
  const list = pool();
  if (!list.length) return [];
  const out = [];
  wantedNames(groups).forEach(function (name) {
    if (out.length >= MAX_MOVES) return;
    const hit = list.filter(function (x) { return String(x && x.n) === name; })[0];
    if (!hit) return;
    out.push(toMove(hit));
  });
  return out.slice(0, MAX_MOVES);
}

// Walks a computed plan and hangs `stretchCooldown` on every training day,
// mirroring warmup-activation.attachToPlan so both sections stay symmetric.
function attachToPlan(node, depth) {
  depth = depth || 0;
  if (!node || typeof node !== 'object' || depth > 6) return node;
  if (Array.isArray(node)) {
    node.forEach(function (item) { attachToPlan(item, depth + 1); });
    return node;
  }
  const looksLikeDay = Object.prototype.hasOwnProperty.call(node, 'warm') &&
    Object.prototype.hasOwnProperty.call(node, 'exercises');
  if (looksLikeDay) {
    node.stretchCooldown = node.isRest ? [] : cooldownFor(node.groups);
  }
  Object.keys(node).forEach(function (k) {
    if (k === 'stretchCooldown' || k === 'warmActivation') return;
    const v = node[k];
    if (v && typeof v === 'object') attachToPlan(v, depth + 1);
  });
  return node;
}

module.exports = { cooldownFor, attachToPlan, wantedNames, MAX_MOVES };
