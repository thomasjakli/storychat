import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../store.mjs';
import { createApplication } from '../server.mjs';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const password='synthetic-test-password';
const blank = source => ({reply:'Synthetic reply.',memories:[{kind:'fact',key:'lantern',text:'The lantern is green.',sources:[source]}],threads:[],relationship:[],thoughts:[],scene:null});
async function fixture(t, generate) {
  const store=new Store(':memory:'); let calls=0;
  const provider={name:'fake',model:'fake-story',generate:async context=>{calls++; return generate ? generate(context) : blank(context.messages.at(-1).id);}};
  const app=createApplication({store,provider,password}); await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
  t.after(()=>app.close()); const origin=`http://127.0.0.1:${app.server.address().port}`;
  let cookie='';
  async function request(path,method='GET',data,extra={}) { const response=await fetch(origin+path,{method,headers:{cookie,'Content-Type':'application/json',...extra},body:data === undefined ? undefined : JSON.stringify(data)}); if(response.headers.get('set-cookie')) cookie=response.headers.get('set-cookie').split(';')[0]; return {status:response.status,headers:response.headers,data:await response.json()}; }
  const login=()=>request('/api/login','POST',{password});
  const c=store.createCharacter({name:'Mira',definition:'An adult mapmaker.'}),p=store.createPersona({name:'Ivo',definition:'An adult visitor.'});
  const story=store.createStory({characterId:c.id,personaId:p.id,title:'Synthetic harbor'});
  return {store,app,origin,request,login,story,calls:()=>calls};
}
async function complete(f,id) {for(let i=0;i<100;i++) {const s=(await f.request(`/api/stories/${id}`)).data; if(s.generations.at(-1)?.status !== 'pending') return s; await new Promise(r=>setTimeout(r,5));} throw new Error('Timed out.');}
test('owner login protects story API, cookies and cross-origin mutations',async t=>{
  const f=await fixture(t); assert.equal((await f.request('/api/library')).status,401);
  assert.equal((await f.request('/api/login','POST',{password:'wrong'})).status,401);
  const login=await f.login(); assert.equal(login.status,200); assert.match(login.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
  assert.equal((await f.request('/api/library')).status,200);
  assert.equal((await f.request('/api/stories','POST',{}, {Origin:'https://attacker.invalid'})).status,403);
  const rebound=await new Promise((resolve,reject)=>{const req=http.get(f.origin+'/api/library',{headers:{Host:'attacker.invalid'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);});
  assert.equal(rebound,403);
  await f.request('/api/logout','POST',{}); assert.equal((await f.request('/api/library')).status,401);
});
test('async turns commit once, replay is idempotent, state and controls API work',async t=>{
  const f=await fixture(t); await f.login(); const path=`/api/stories/${f.story.id}`;
  const result=await f.request(path+'/turns','POST',{requestId:'same-request',text:'The lantern is green.'});
  assert.equal(result.status,202); assert.equal(result.data.generation.context,undefined);
  const story=await complete(f,f.story.id); assert.equal(story.memories.length,1); assert.equal(story.messages.length,2);
  const replay=await f.request(path+'/turns','POST',{requestId:'same-request',text:'The lantern is green.'}); assert.equal(replay.status,202); assert.equal(f.calls(),1);
  assert.equal((await f.request(path+'/turns','POST',{requestId:'same-request',text:'Different'})).status,400);
  const controls={tone:'Warm',detail:'rich',length:'short'}; assert.deepEqual((await f.request(path+'/controls','PATCH',controls)).data.controls,controls);
  const memoryPath=path+'/memories/'+story.memories[0].id;
  assert.equal((await f.request(memoryPath,'PATCH',{text:'The lantern is amber.',pinned:true})).data.memories[0].corrected,true);
  assert.equal((await f.request(memoryPath,'DELETE')).data.memories.length,0);
  assert.equal((await f.request(path,'DELETE')).status,200); assert.equal((await f.request(path)).status,404);
});
test('instance concurrency bounded, browser request ending does not cancel server work',async t=>{
  let release; const gate=new Promise(r=>{release=r;});
  const f=await fixture(t,async context=>{await gate;return blank(context.messages.at(-1).id);}); await f.login();
  const path=`/api/stories/${f.story.id}`;
  assert.equal((await f.request(path+'/turns','POST',{requestId:'pending',text:'Test'})).status,202);
  assert.equal((await f.request(path+'/turns','POST',{requestId:'second',text:'Other'})).status,409);
  release(); assert.equal((await complete(f,f.story.id)).generations[0].status,'completed'); assert.equal(f.calls(),1);
});
test('provider exception cannot expose secrets or create partial state',async t=>{
  const f=await fixture(t,()=>{throw new Error('SECRET_SENTINEL arbitrary provider body');}); await f.login();
  await f.request(`/api/stories/${f.story.id}/turns`,'POST',{requestId:'fail',text:'Test'});
  const s=await complete(f,f.story.id); assert.equal(s.generations[0].status,'failed'); assert.equal(s.memories.length,0); assert.equal(s.messages.length,1); assert.ok(!JSON.stringify(s).includes('SECRET_SENTINEL'));
});
test('startup port conflict releases database lock instead of stranding the runtime',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'storychat-startup-')); t.after(()=>rm(directory,{recursive:true,force:true}));
  const occupied=http.createServer(); await new Promise(r=>occupied.listen(0,'127.0.0.1',r)); t.after(()=>new Promise(r=>occupied.close(r)));
  const db=join(directory,'dedicated','story.sqlite');
  const child=spawn(process.execPath,[fileURLToPath(new URL('../server.mjs',import.meta.url))],{env:{...process.env,STORYCHAT_PASSWORD:password,STORYCHAT_PROVIDER:'fake',STORYCHAT_DB:db,STORYCHAT_HOST:'127.0.0.1',STORYCHAT_ORIGIN:'',PORT:String(occupied.address().port)},stdio:['ignore','pipe','pipe']});
  let output=''; child.stdout.on('data',chunk=>{output+=chunk;}); child.stderr.on('data',chunk=>{output+=chunk;});
  const timeout=setTimeout(()=>child.kill(),10000); const [code]=await once(child,'exit'); clearTimeout(timeout);
  assert.equal(code,1); assert.match(output,/Startup failed/);
  await assert.rejects(access(db+'.lock'),{code:'ENOENT'});
  const reopened=new Store(db); assert.equal(reopened.library().stories.length,0); reopened.close();
});
