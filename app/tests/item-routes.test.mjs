import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {Store} from '../store.mjs';
import {MediaStore} from '../media.mjs';
import {createApplication} from '../server.mjs';
import {exportBundle,stageItemBundle} from '../media-transfer.mjs';
import {exportItem} from '../item-transfer.mjs';

test('authenticated item routes isolate exports, preview without writes and remap repeated imports',async t=>{
 const root=await mkdtemp(join(tmpdir(),'storychat-items-')),store=new Store(':memory:'),media=new MediaStore(root);let calls=0;
 const app=createApplication({store,media,password:'synthetic-password',provider:{name:'fake',generate:async()=>{calls++;}}});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await app.close();await rm(root,{recursive:true,force:true});});
 const origin=`http://127.0.0.1:${app.server.address().port}`;let cookie='';
 const req=async(path,method='GET',body)=>{const r=await fetch(origin+path,{method,headers:{cookie,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,data:await r.json()};};
 assert.equal((await req('/api/items/preview','POST',{})).status,401);
 await req('/api/login','POST',{password:'synthetic-password'});
 const cover=await media.upload(await sharp({create:{width:32,height:48,channels:3,background:'#617080'}}).png().toBuffer());
 const p=(await req('/api/personas','POST',{name:'Synthetic visitor',definition:'An original traveler.',cover:cover.id,age:38,likes:'Maps',dislikes:'Noise',gender:'other'})).data;
 assert.equal(p.cover,cover.id);
 const c=store.createCharacter({name:'Synthetic guide',definition:'A reserved guide.'});const story=store.createStory({characterId:c.id,personaId:p.id,title:'Original scene'});const original=store.getStory(story.id);
 const exp=await req(`/api/personas/${p.id}/export`);assert.equal(exp.status,200);assert.equal(exp.data.data.library.length,1);assert.equal(exp.data.data.stories.length,0);assert.equal(exp.data.assets.length,1);
 const before=await media.usage();const preview=await req('/api/items/preview','POST',exp.data);assert.equal(preview.data.type,'persona');assert.equal(preview.data.data.age,38);assert.deepEqual(await media.usage(),before);
 const bad=structuredClone(exp.data);bad.assets[0].image='AAAA';assert.equal((await req('/api/items/preview','POST',bad)).status,400);assert.deepEqual(await media.usage(),before);
 for(let n=0;n<2;n++){const imported=await req('/api/items/import','POST',exp.data);assert.equal(imported.status,201);assert.notEqual(imported.data.data.id,p.id);assert.notEqual(imported.data.data.cover,cover.id);assert.equal((await media.metadata(imported.data.data.cover)).checksum,cover.checksum);}
 assert.equal(store.library().personas.length,3);assert.deepEqual(store.getStory(story.id),original);assert.equal(calls,0);
 assert.equal((await req('/api/media/'+cover.id,'DELETE')).status,409);
 assert.equal((await req(`/api/personas/${p.id}`,'PATCH',{cover:'00000000-0000-0000-0000-000000000000'})).status,404);
 const characterExport=(await req(`/api/characters/${c.id}/export`)).data;assert.equal((await req('/api/items/import','POST',characterExport)).status,201);
 assert.equal((await req('/api/import','POST',exp.data)).status,409);
 const usageBeforeFailure=await media.usage(),create=store.createDefinition;
 store.createDefinition=()=>{throw Object.assign(Error('Synthetic insert failure'),{code:'conflict'});};
 assert.equal((await req('/api/items/import','POST',exp.data)).status,409);store.createDefinition=create;
 assert.deepEqual(await media.usage(),usageBeforeFailure);
 await req(`/api/personas/${p.id}`,'PATCH',{cover:''});await req(`/api/personas/${p.id}`,'DELETE');
 assert.equal((await req('/api/media/'+cover.id,'DELETE')).status,409);
 assert.deepEqual(store.getStory(story.id),original);
});

test('item staged media rollback removes fresh files and preserves originals',async()=>{
 const root=await mkdtemp(join(tmpdir(),'storychat-item-rollback-'));const store=new Store(':memory:');
 try{const media=new MediaStore(root),m=await media.upload(await sharp({create:{width:16,height:16,channels:3,background:'#456789'}}).png().toBuffer());const c=store.createCharacter({name:'Original fixture',definition:'Synthetic.',cover:m.id});const packageData=await exportBundle(exportItem(store,'character',c.id),media);const staged=await stageItemBundle(packageData,media);assert.equal((await media.usage()).assets,2);await staged.rollback();assert.equal((await media.usage()).assets,1);assert.equal((await media.metadata(m.id)).checksum,m.checksum);}finally{store.close();await rm(root,{recursive:true,force:true});}
});

test('persona picture and immutable snapshot survive isolated offline backup restore',async()=>{
 const {backupDatabase,restoreDatabase}=await import('../backup.mjs');
 const root=await mkdtemp(join(tmpdir(),'storychat-persona-restore-'));
 let source,target;
 try{
  const media=new MediaStore(join(root,'media')),asset=await media.upload(await sharp({create:{width:20,height:30,channels:3,background:'#789abc'}}).png().toBuffer());
  source=new Store(join(root,'source.sqlite'));const c=source.createCharacter({name:'Original guide',definition:'Original fixture.'}),p=source.createPersona({name:'Original visitor',definition:'Synthetic persona.',age:40,likes:'Gardens',dislikes:'Crowds',gender:'woman',cover:asset.id});const story=source.createStory({characterId:c.id,personaId:p.id,title:'Synthetic recovery'});
  source.updateDefinition('persona',p.id,{likes:'Libraries',cover:''});source.close();source=null;
  await backupDatabase(join(root,'source.sqlite'),join(root,'backup.json'),media.directory);
  await restoreDatabase(join(root,'backup.json'),join(root,'target.sqlite'),join(root,'target-media'));
  target=new Store(join(root,'target.sqlite'));assert.equal(target.definition(p.id,'persona').likes,'Libraries');assert.equal(target.getStory(story.id).persona.likes,'Gardens');assert.equal(target.getStory(story.id).persona.cover,asset.id);
  assert.equal((await new MediaStore(join(root,'target-media')).metadata(asset.id)).checksum,asset.checksum);
 }finally{source?.close();target?.close();await rm(root,{recursive:true,force:true});}
});
