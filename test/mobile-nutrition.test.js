'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

process.env.EF_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ef-mobile-nutrition-'));
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
        const setCookie = res.headers['set-cookie'] || [];
        const match = /ef_session=[^;]*/.exec(setCookie.join(';'));
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
  const email = `nutrition_${Date.now()}@gmail.com`;
  const signup = await request('POST', '/api/auth/signup', {
    email, password:'supersecret123', name:'Nutrition Tester',
  });
  if (signup.status !== 201 || !signup.cookie) throw new Error('signup failed');
  const cookie = signup.cookie;

  const search = await request('GET', '/api/mobile/foods?q=%D9%81%D8%B1%D8%A7%D8%AE&cat=protein&diet=balanced', null, cookie);
  if (search.status !== 200 || !Array.isArray(search.json.foods) || !search.json.foods.length) {
    throw new Error('food search endpoint failed');
  }
  const food = search.json.foods[0];
  const preference = await request('PUT', '/api/mobile/food-preference', {
    foodId:food.id, favorite:true, used:true,
  }, cookie);
  if (preference.status !== 200 || !preference.json.preference || preference.json.preference.favorite !== 1 || preference.json.preference.use_count !== 1) {
    throw new Error('food preference save failed');
  }
  const preferences = await request('GET', '/api/mobile/food-preferences', null, cookie);
  if (preferences.status !== 200 || preferences.json.favorites[0].id !== food.id || preferences.json.recent[0].id !== food.id) {
    throw new Error('favorite/recent foods failed');
  }
  const annotatedSearch = await request('GET', '/api/mobile/foods?q=%D9%81%D8%B1%D8%A7%D8%AE&cat=protein&diet=balanced', null, cookie);
  const annotated = annotatedSearch.json.foods.find((item) => item.id === food.id);
  if (!annotated || annotated.favorite !== true || annotated.useCount !== 1) {
    throw new Error('food search preference annotation failed');
  }
  const nutrition = await request('PUT', '/api/mobile/nutrition', {
    calories:330, protein:62, carbs:0, fat:7.2, waterMl:750,
    meals:[{key:'lunch', name:'الغداء', completed:true, foods:[{
      id:food.id, name:food.nameAr, grams:200, cals:330, pro:62, carb:0, fat:7.2,
    }]}],
  }, cookie);
  if (nutrition.status !== 200 || nutrition.json.nutrition.waterMl !== 750) {
    throw new Error('nutrition save failed');
  }

  const bootstrap = await request('GET', '/api/mobile/bootstrap', null, cookie);
  const today = bootstrap.json.nutritionToday;
  if (bootstrap.status !== 200 || !today || today.waterMl !== 750 || !today.meals[0].completed) {
    throw new Error('nutrition bootstrap persistence failed');
  }
  console.log('Mobile nutrition favorites, recent and meal flow passed');
  server.close(() => process.exit(0));
})().catch((error) => {
  console.error(error);
  server.close(() => process.exit(1));
});
