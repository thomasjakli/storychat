import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import sharp from 'sharp';import {Store} from '../store.mjs';import {MediaStore} from '../media.mjs';import {createApplication} from '../server.mjs';
test('explorer HTTP protects local catalogue/media, validates queries and never infers for library actions',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'storychat-explorer-'));const store=new Store(':memory:');const media=new MediaStore(directory);let calls=0;
 const app=createApplication({store,media,password:'synthetic-explorer-password',provider:{name:'fake',async generate(){calls++;throw Error('Unexpected inference');},async close(){}}});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(async()=>{await app.close();await rm(directory,{recursive:true,force:true});});
 const origin=`http://127.0.0.1:${app.server.address().port}`;let cookie='';
 async function req(path,method='GET',data,raw=false){const response=await fetch(origin+path,{method,headers:{cookie,'Content-Type':raw?'image/png':'application/json'},body:data===undefined?undefined:raw?data:JSON.stringify(data)});if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];const bytes=Buffer.from(await response.arrayBuffer());let body;try{body=JSON.parse(bytes);}catch{}return {status:response.status,data:body,bytes};}
 assert.equal((await req('/api/characters')).status,401);assert.equal((await req('/api/media','POST',Buffer.from('not image'),true)).status,401);
 assert.equal((await req('/api/login','POST',{password:'synthetic-explorer-password'})).status,200);
 assert.equal((await req('/api/characters?limit=101')).status,400);assert.equal((await req('/api/characters?favorites=yes')).status,400);assert.equal((await req('/api/characters?unknown=1')).status,400);
 const png=await sharp({create:{width:60,height:90,channels:3,background:'#448866'}}).png().toBuffer();const upload=await req('/api/media','POST',png,true);assert.equal(upload.status,201);const cover=upload.data.asset.id;
 assert.equal((await req('/api/media','POST',Buffer.from('<svg>unsafe</svg>'),true)).status,400);
 const created=await req('/api/characters','POST',{name:'Original field guide',definition:'Original adult botanist.',intro:'A quiet garden.',opening:'Welcome to the greenhouse.',category:'Nature',tags:['Plants'],favorite:true,cover});assert.equal(created.status,201);const c=created.data;
 const summaries=await req('/api/library?summary=true');assert.equal(summaries.status,200);assert.equal(summaries.data.characters[0].definition,undefined);assert.equal(summaries.data.characters[0].intro,undefined);assert.equal(summaries.data.characters[0].opening,undefined);
 const list=await req('/api/characters?q=garden&favorites=true&tag=plants');assert.equal(list.status,200);assert.equal(list.data.total,1);assert.equal(list.data.items[0].id,c.id);assert.equal(list.data.items[0].definition,undefined);
 assert.equal((await req(`/api/characters/${c.id}`)).data.opening,'Welcome to the greenhouse.');assert.equal((await req(`/api/media/${cover}`)).status,200);assert.equal((await req(`/api/media/${cover}/thumbnail`)).status,200);
 const p=(await req('/api/personas','POST',{name:'Visitor',definition:'Original adult.'})).data;
 const s=(await req('/api/stories','POST',{characterId:c.id,personaId:p.id,title:'Garden'})).data;assert.deepEqual(s.messages.map(m=>m.kind),['intro','opening']);
 assert.equal((await req(`/api/characters/${c.id}`,'PATCH',{intro:'Changed premise',favorite:false})).status,200);assert.equal((await req(`/api/stories/${s.id}`)).data.character.intro,'A quiet garden.');
 assert.equal((await req('/api/characters?favorites=true')).data.total,0);
 await req('/api/logout','POST',{});assert.equal((await req(`/api/media/${cover}`)).status,401);assert.equal((await req(`/api/characters/${c.id}`)).status,401);assert.equal(calls,0);
});
