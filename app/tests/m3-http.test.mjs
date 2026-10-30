import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../store.mjs';
import { createApplication } from '../server.mjs';

test('M3 owner APIs preserve snapshots and safely replace turns without exposing rollback state', async t=>{
  const store=new Store(':memory:');let calls=0;
  const app=createApplication({store,password:'synthetic-m3-password',provider:{name:'fake',async generate(){calls++;return {reply:'Synthetic revised reply.',memories:[],threads:[],relationship:[],thoughts:[],scene:null};}}});
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());
  const origin=`http://127.0.0.1:${app.server.address().port}`;let cookie='';
  async function req(path,method='GET',data){const r=await fetch(origin+path,{method,headers:{cookie,'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,data:await r.json()};}
  assert.equal((await req('/api/export')).status,401);assert.equal((await req('/api/import','POST',{})).status,401);
  await req('/api/login','POST',{password:'synthetic-m3-password'});
  const c=(await req('/api/characters','POST',{name:'Nera',definition:'Synthetic adult archivist.'})).data;
  const p=(await req('/api/personas','POST',{name:'Sol',definition:'Synthetic adult visitor.'})).data;
  const s=(await req('/api/stories','POST',{characterId:c.id,personaId:p.id,title:'Original synthetic scene'})).data;
  assert.equal((await req(`/api/characters/${c.id}`,'PATCH',{name:'Edited Nera'})).status,200);
  assert.equal((await req(`/api/stories/${s.id}`)).data.character.name,'Nera');
  assert.equal((await req(`/api/personas/${p.id}/duplicate`,'POST',{})).status,201);
  const path=`/api/stories/${s.id}`;
  const first=await req(path+'/turns','POST',{requestId:'first',text:'A synthetic scene.'});assert.equal(first.status,202);assert.equal(first.data.generation.baseSnapshot,undefined);
  async function complete(){for(let i=0;i<100;i++){const v=(await req(path)).data;if(v.generations.at(-1).status!=='pending')return v;await new Promise(r=>setTimeout(r,5));}throw Error('Synthetic generation timed out.');}
  const before=await complete();const payload={requestId:'replace',generationId:before.generations.at(-1).id,revision:before.revision,text:'A corrected synthetic scene.'};
  const replacement=await req(path+'/turns/replace','POST',payload);assert.equal(replacement.status,202);assert.equal(replacement.data.generation.baseSnapshot,undefined);
  const after=await complete();assert.equal(after.generations.at(-1).status,'completed');
  assert.equal((await req(path+'/turns/replace','POST',payload)).status,202);assert.equal(calls,2);
  const exported=await req('/api/export');assert.equal(exported.status,200);
  assert.equal((await req('/api/import','POST',exported.data)).status,409);
  await req('/api/logout','POST',{});assert.equal((await req(path+'/turns/replace','POST',payload)).status,401);
});
