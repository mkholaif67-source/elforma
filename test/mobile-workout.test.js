'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

process.env.EF_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ef-mobile-workout-'));
process.env.PORT = '0';
const server = require('../server');

function request(method, pathname, body, cookie) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const payload = body == null ? null : JSON.stringify(body);
    const headers = {};
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (cookie) headers.Cookie = cookie;
    const req = http.request({host:'127.0.0.1', port:address.port, method, path:pathname, headers}, (res) => {
      let raw = '';
      res.on('data', (chunk) => raw += chunk);
      res.on('end', () => {
        const json = JSON.parse(raw || '{}');
        const cookies = res.headers['set-cookie'] || [];
        const match = /ef_session=[^;]*/.exec(cookies.join(';'));
        resolve({status:res.statusCode, json, cookie:match && match[0]});
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

(async () => {
  await new Promise((resolve) => server.listening ? resolve() : server.on('listening', resolve));
  const signup = await request('POST', '/api/auth/signup', {
    email:`workout_${Date.now()}@gmail.com`, password:'supersecret123', name:'Workout Tester',
  });
  if (signup.status !== 201 || !signup.cookie) throw new Error('signup failed');
  const cookie = signup.cookie;

  const alternatives = await request('GET',
    '/api/mobile/exercise-alternatives?current=Barbell%20Bench%20Press&equipment=gym&goal=muscle&injuries=back',
    null, cookie);
  if (alternatives.status !== 200 || alternatives.json.exercises.length < 2) {
    throw new Error('exercise alternatives failed');
  }
  if (alternatives.json.exercises.some((exercise) => {
    const safe = exercise.safe_injuries || [];
    return !safe.includes('back') && !safe.includes('back_mild');
  })) throw new Error('unsafe exercise alternative returned');
  if (!alternatives.json.exercises[0].vid) throw new Error('alternative video metadata missing');

  const plan = await request('PUT', '/api/mobile/workout-plan', {
    key:'upper', plan:{key:'upper', name:'Upper', plan:[{key:'upper_1', name:'Upper 1', exercises:[]}]},
  }, cookie);
  if (plan.status !== 200) throw new Error('plan activation failed');

  const start = await request('POST', '/api/mobile/session/start', {
    dayKey:'upper_1', dayName:'Upper 1',
  }, cookie);
  const sessionId = start.json.session && start.json.session.id;
  if (start.status !== 201 || !sessionId) throw new Error('session start failed');

  const saved = await request('PUT', '/api/mobile/session/set', {
    sessionId, exerciseKey:'bench_press', exerciseName:'Barbell Bench Press',
    setNumber:1, weight:80, reps:10, rir:2, completed:true,
  }, cookie);
  if (saved.status !== 200 || saved.json.sets[0].rir !== 2) throw new Error('RIR set save failed');

  const finish = await request('POST', '/api/mobile/session/finish', {
    sessionId, durationSec:1800, notes:'good session',
  }, cookie);
  if (finish.status !== 200) throw new Error('session finish failed');

  const history = await request('GET', '/api/mobile/exercise-history?exerciseKey=bench_press', null, cookie);
  if (history.status !== 200 || history.json.sets.length !== 1) throw new Error('exercise history failed');
  if (history.json.sets[0].weight !== 80 || history.json.sets[0].reps !== 10 || history.json.sets[0].rir !== 2) {
    throw new Error('exercise history values mismatch');
  }
  if (!history.json.best || history.json.best.e1rm <= 100) throw new Error('e1RM summary failed');

  const workoutHistory = await request('GET', '/api/mobile/workout-history', null, cookie);
  if (workoutHistory.status !== 200 || workoutHistory.json.sessions.length !== 1) {
    throw new Error('workout history failed');
  }
  const analytics = workoutHistory.json.analytics;
  if (analytics.totalSessions !== 1 || analytics.totalSets !== 1 || analytics.totalVolume !== 800) {
    throw new Error('workout analytics mismatch');
  }
  if (!workoutHistory.json.bestLifts[0] || workoutHistory.json.bestLifts[0].e1rm <= 100) {
    throw new Error('best lifts analytics failed');
  }
  if (workoutHistory.json.weeks.length !== 8) throw new Error('weekly analytics failed');
  if (!workoutHistory.json.coach || workoutHistory.json.coach.status !== 'building_history') {
    throw new Error('coach history state failed');
  }
  if (!workoutHistory.json.coach.muscleVolume.some((row) => row.key === 'chest' && row.currentSets === 1)) {
    throw new Error('muscle volume analytics failed');
  }

  console.log('Mobile workout progression, alternatives, history and coach flow passed');
  server.close(() => process.exit(0));
})().catch((error) => {
  console.error(error);
  server.close(() => process.exit(1));
});
