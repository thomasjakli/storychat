import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../store.mjs';
import {exportData,importData} from '../transfer.mjs';
import {validateItem,exportItem,importItem} from '../item-transfer.mjs';
import {collectMediaReferences} from '../media.mjs';

test('persona fields survive snapshots, edits, duplication and transfer without rewriting old stories',()=>{
 const store=new Store(':memory:'),restored=new Store(':memory:');try{
  const c=store.createCharacter({name:'Ash',definition:'Original reserved adult.'});
  const p=store.createPersona({name:'River',definition:'Original adult visitor.',likes:'Rain',dislikes:'Noise',age:31,gender:'nonbinary',cover:'synthetic-cover',focalPoint:{x:.2,y:.7}});
  const story=store.createStory({characterId:c.id,personaId:p.id,title:'Synthetic encounter'});
  const before=store.getStory(story.id);
  store.updateDefinition('persona',p.id,{age:32,likes:'Snow',cover:''});
  assert.deepEqual(store.getStory(story.id),before);
  const turn=store.beginTurn(story.id,{requestId:'synthetic-persona',text:'Hello.'});assert.equal(turn.context.persona.age,31);store.failTurn(story.id,turn.generation.id);
  const duplicate=store.duplicateDefinition('persona',p.id);assert.equal(duplicate.age,32);assert.equal(duplicate.dislikes,'Noise');assert.notEqual(duplicate.id,p.id);
  importData(restored,exportData(store,{includeHistory:true}));assert.equal(restored.getStory(story.id).persona.cover,'synthetic-cover');assert.equal(restored.definition(p.id,'persona').age,32);
 }finally{store.close();restored.close();}
});

test('legacy personas acquire defaults on read while legacy story snapshots stay exact',()=>{
 const a=new Store(':memory:'),b=new Store(':memory:');try{
  const c=a.createCharacter({name:'Ash',definition:'Adult.'}),p=a.createPersona({name:'River',definition:'Adult.'}),s=a.createStory({characterId:c.id,personaId:p.id,title:'Legacy'});
  const backup=exportData(a);for(const e of backup.library)if(e.type==='persona')for(const k of ['cover','focalPoint','likes','dislikes','age','gender'])delete e.data[k];
  for(const k of ['cover','focalPoint','likes','dislikes','age','gender'])delete backup.stories[0].persona[k];
  importData(b,backup);assert.equal(b.definition(p.id,'persona').age,null);assert.equal(b.definition(p.id,'persona').likes,'');assert.deepEqual(b.load(s.id),backup.stories[0]);
 }finally{a.close();b.close();}
});

test('standalone items add fresh identities and exclude unrelated stories and records',()=>{
 const a=new Store(':memory:');try{
  const c=a.createCharacter({name:'Ash',definition:'Adult.',intro:'A quiet entrance.'}),p=a.createPersona({name:'River',definition:'Adult.',likes:'Rain'});
  const story=a.createStory({characterId:c.id,personaId:p.id,title:'Untouched'});const before=a.getStory(story.id);
  for(const [type,original]of [['character',c],['persona',p]]){
   const item=exportItem(a,type,original.id);assert.equal(item.library.length,1);assert.deepEqual(item.stories,[]);
   const one=importItem(a,item),two=importItem(a,item);assert.notEqual(one.data.id,original.id);assert.notEqual(one.data.id,two.data.id);assert.equal(one.data.version,1);
  }
  assert.deepEqual(a.getStory(story.id),before);
  assert.throws(()=>validateItem(exportData(a)),{code:'invalid'});
  assert.throws(()=>validateItem({...exportItem(a,'persona',p.id),version:2}),{code:'invalid'});
 }finally{a.close();}
});

test('invalid persona fields fail without partial updates',()=>{
 const a=new Store(':memory:');try{
  const p=a.createPersona({name:'River',definition:'Adult.'});
  for(const fields of [{age:-1},{age:1.5},{age:10001},{gender:'invalid'},{likes:'x'.repeat(2001)},{focalPoint:{x:2,y:0}}]){
   assert.throws(()=>a.updateDefinition('persona',p.id,fields),{code:'invalid'});assert.deepEqual(a.definition(p.id,'persona'),p);
  }
 }finally{a.close();}
});

test('QA persona age zero survives item import and only story snapshots retain removed library pictures',()=>{
 const a=new Store(':memory:');try{
  const cover='11111111-1111-4111-8111-111111111111';
  const p=a.createPersona({name:'Original fixture',definition:'Synthetic persona.',age:0,cover});
  const c=a.createCharacter({name:'Original guide',definition:'Synthetic character.'});
  const story=a.createStory({characterId:c.id,personaId:p.id,title:'Reference test'});
  const imported=importItem(a,exportItem(a,'persona',p.id));assert.equal(imported.data.age,0);
  a.deleteDefinition('persona',imported.data.id);a.updateDefinition('persona',p.id,{cover:''});a.deleteDefinition('persona',p.id);
  assert.deepEqual([...collectMediaReferences(exportData(a))],[cover]);
  assert.equal(a.getStory(story.id).persona.age,0);a.deleteStory(story.id);
  assert.equal(collectMediaReferences(exportData(a)).size,0);
 }finally{a.close();}
});

