'use strict';
// GENERATED-BY-BATCH15 - lib/warmup-activation.js
//
// Muscle activation moves for the guided warmup.
//
// HARD RULE: this file NEVER stores a video id of its own. It reads the very
// same engine database the website serves (app/workout/engine/db.js) and hands
// back whatever ids are authored there. If a move has no authored video the
// move is returned without one - we never substitute, never guess.

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const DB_FILE = path.join(__dirname, '..', 'app', 'workout', 'engine', 'db.js');

let _cache = null;

function moduleDb() {
  if (_cache) return _cache;
  try {
    const src = fs.readFileSync(DB_FILE, 'utf8');
    const ctx = { window: {}, document: {}, console: { log() {}, warn() {}, error() {} } };
    vm.createContext(ctx);
    // MODULE_DB is a top-level `const`, so it never lands on globalThis by
    // itself. Re-export it explicitly.
    new vm.Script(src + '\nglobalThis.__EF_MODULE_DB__ = (typeof MODULE_DB !== "undefined") ? MODULE_DB : null;',
      { filename: 'engine/db.js' }).runInContext(ctx);
    _cache = ctx.__EF_MODULE_DB__ || {};
  } catch (e) {
    _cache = {};
  }
  return _cache;
}

const PUSH = ['chest', 'shoulders', 'triceps', 'front_delt', 'side_delt', 'delts'];
const PULL = ['back', 'lats', 'biceps', 'rear_delt', 'traps', 'forearms'];
const LEGS = ['quads', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors'];

// Which authored mobility moves prepare which kind of day.
const BY_PATTERN = {
  push: ['Shoulder CARs', 'Thoracic Rotation (CARs)', 'Band Shoulder Opener'],
  pull: ['Thoracic Rotation (CARs)', 'Cat-Cow Spinal Flow', 'Wall Slides'],
  legs: ['Hip 90/90 Flow', 'Ankle CARs', 'Deep Squat Hold'],
  core: ['Cat-Cow Spinal Flow', 'World Greatest Stretch'],
  full: ['World Greatest Stretch', 'Shoulder CARs', 'Hip 90/90 Flow']
};

function normalizeGroups(groups) {
  const out = [];
  (Array.isArray(groups) ? groups : []).forEach(function (g) {
    const name = Array.isArray(g) ? g[0] : g;
    if (typeof name === 'string' && name.trim()) out.push(name.trim().toLowerCase());
  });
  return out;
}

function patternFor(groups) {
  const g = normalizeGroups(groups);
  if (!g.length) return 'full';
  const hasPush = g.some(function (x) { return PUSH.indexOf(x) > -1; });
  const hasPull = g.some(function (x) { return PULL.indexOf(x) > -1; });
  const hasLegs = g.some(function (x) { return LEGS.indexOf(x) > -1; });
  if (hasLegs && !hasPush && !hasPull) return 'legs';
  if (hasPush && !hasPull && !hasLegs) return 'push';
  if (hasPull && !hasPush && !hasLegs) return 'pull';
  if (!hasPush && !hasPull && !hasLegs) return 'core';
  return 'full';
}

// Returns [{ name, detail, videoId, hasVideo }] - at most 3 moves.
function activationFor(groups) {
  const db = moduleDb();
  const pool = (db && Array.isArray(db.mobility)) ? db.mobility : [];
  if (!pool.length) return [];
  const wanted = BY_PATTERN[patternFor(groups)] || BY_PATTERN.full;
  const out = [];
  wanted.forEach(function (name) {
    const hit = pool.filter(function (x) { return String(x && x.n) === name; })[0];
    if (!hit) return;
    const vid = (typeof hit.vid === 'string' && hit.vid.trim()) ? hit.vid.trim() : '';
    const bits = [];
    if (hit.duration) bits.push(String(hit.duration));
    if (hit.target) bits.push(String(hit.target));
    out.push({
      name: String(hit.n),
      detail: bits.join('  -  '),
      videoId: vid,
      hasVideo: !!vid
    });
  });
  return out.slice(0, 3);
}

// Walks a computed plan and hangs `warmActivation` on every training day.
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
    if (node.isRest) {
      node.warmActivation = [];
    } else {
      node.warmActivation = activationFor(node.groups);
    }
  }
  Object.keys(node).forEach(function (k) {
    if (k === 'warmActivation') return;
    const v = node[k];
    if (v && typeof v === 'object') attachToPlan(v, depth + 1);
  });
  return node;
}

module.exports = { moduleDb, activationFor, attachToPlan, patternFor, normalizeGroups };
