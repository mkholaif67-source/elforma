'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

process.env.EF_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ef-mobile-privacy-'));
process.env.PORT = '0';
const server = require('../server');

function request(method, pathname, body, cookie) {
  return new Promise((resolve, reject) => {
    const payload = body == null ? null : JSON.stringify(body);
    const headers = {};
    if (payload) { headers['Content-Type']='application/json'; headers['Content-Length']=Buffer.byteLength(payload); }
    if (cookie) headers.Cookie = cookie;
    const req = http.request({host:'127.0.0.1',port:server.address().port,method,path:pathname,headers}, res => {
      let raw='';res.on('data',chunk=>raw+=chunk);res.on('end',()=>{
        let json={};try{json=JSON.parse(raw||'{}');}catch(_){}
        const cookies=res.headers['set-cookie']||[];const match=/ef_session=[^;]*/.exec(cookies.join(';'));
        resolve({status:res.statusCode,json,cookie:match&&match[0]});
      });
    });
    req.on('error',reject);if(payload)req.write(payload);req.end();
  });
}

(async()=>{
  await new Promise(resolve=>server.listening?resolve():server.on('listening',resolve));
  const signup=await request('POST','/api/auth/signup',{
    email:`privacy_${Date.now()}@gmail.com`,password:'supersecret123',name:'Privacy Tester'
  });
  if(signup.status!==201||!signup.cookie)throw new Error('signup failed');
  const cookie=signup.cookie;
  const profile=await request('PUT','/api/mobile/profile',{profile:{
    age:30,height:178,weight:82,targetWeight:76,trainingDays:4,trainingMinutes:60,mealCount:4,onboardingComplete:true
  }},cookie);
  if(profile.status!==200)throw new Error('profile save failed');
  const weight=await request('PUT','/api/mobile/weight',{day:'2026-07-25',weight:82},cookie);
  if(weight.status!==200)throw new Error('weight save failed');
  const event=await request('POST','/api/mobile/client-event',{
    type:'test',message:'safe test event',stack:'test stack',appVersion:'2.1.0+12'
  },cookie);
  if(event.status!==201)throw new Error('client event failed');
  const exported=await request('GET','/api/account/export',null,cookie);
  if(exported.status!==200||!exported.json.mobile||exported.json.mobile.profile.weight!==82) {
    throw new Error('mobile data export failed');
  }
  if(exported.json.mobile.weights[0].weight!==82)throw new Error('weight export failed');
  const deleted=await request('POST','/api/account/delete',{},cookie);
  if(deleted.status!==200||deleted.json.ok!==true)throw new Error('account deletion failed');
  const me=await request('GET','/api/auth/me',null,cookie);
  if(me.status!==200||me.json.user!==null)throw new Error('deleted account still authenticated');
  const exportAfterDelete=await request('GET','/api/account/export',null,cookie);
  if(exportAfterDelete.status!==401)throw new Error('deleted account data still accessible');
  console.log('Mobile privacy, export, event and deletion flow passed');
  server.close(()=>process.exit(0));
})().catch(error=>{console.error(error);server.close(()=>process.exit(1));});
