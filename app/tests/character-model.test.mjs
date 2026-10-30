import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../store.mjs';
import {exportData,importData} from '../transfer.mjs';

test('expanded characters retain independent snapshots and typed intro through restart and restore',()=>{
 const directory=mkdtempSync(join(tmpdir(),'storychat-character-'));let a=new Store(join(directory,'story.sqlite'));const b=new Store(':memory:');
 try {
  const c=a.createCharacter({name:'Märta',definition:'Original adult archivist.',subtitle:'An original test',intro:'A quiet arrival.',opening:'Welcome.\n\n*Offers a chair.*',gender:'woman',pronouns:'she/her',category:'Contemporary',tags:['Quiet','quiet','Grün'],cover:'synthetic-cover',focalPoint:{x:0.2,y:0.7},origin:{system:'original',author:'Synthetic fixture'},favorite:true});
  const p=a.createPersona({name:'Visitor',definition:'Original adult visitor.'});
  const s=a.createStory({characterId:c.id,personaId:p.id,title:'Original fixture'});
  assert.deepEqual(s.messages.map(m=>m.kind),['intro','opening']);assert.equal(s.generations.length,0);assert.equal(s.memories.length,0);
  assert.equal(s.character.favorite,undefined);assert.deepEqual(c.tags,['Quiet','Grün']);
  a.updateDefinition('character',c.id,{intro:'Changed library premise.',cover:''});
  const version=a.definition(c.id,'character').version;a.updateDefinition('character',c.id,{favorite:false});assert.equal(a.definition(c.id,'character').version,version);
  assert.equal(a.getStory(s.id).character.intro,'A quiet arrival.');assert.equal(a.getStory(s.id).character.cover,'synthetic-cover');
  const copy=a.duplicateDefinition('character',c.id);assert.equal(copy.gender,'woman');assert.equal(copy.intro,'Changed library premise.');
  const turn=a.beginTurn(s.id,{requestId:'synthetic',text:'Hello.'});assert.equal(turn.context.character.intro,'A quiet arrival.');assert.equal(turn.context.character.favorite,undefined);a.failTurn(s.id,turn.generation.id);
  a.close();a=new Store(join(directory,'story.sqlite'));assert.equal(a.getStory(s.id).messages[0].kind,'intro');
  importData(b,exportData(a,{includeHistory:true}));assert.deepEqual(b.getStory(s.id),a.getStory(s.id));assert.equal(b.definition(c.id,'character').favorite,false);
 } finally {a.close();b.close();rmSync(directory,{recursive:true,force:true});}
});

test('draft readiness and paginated accent-insensitive local search fail safely',()=>{
 const a=new Store(':memory:');try{
  const draft=a.createCharacter({name:'Unfinished',definition:'',draft:true});const p=a.createPersona({name:'Visitor',definition:'Adult.'});assert.throws(()=>a.createStory({characterId:draft.id,personaId:p.id,title:'No'}),{code:'invalid'});
  assert.throws(()=>a.updateDefinition('character',draft.id,{draft:false}),{code:'invalid'});
  a.updateDefinition('character',draft.id,{definition:'Ready original adult.',draft:false});
  for(let i=0;i<29;i++)a.createCharacter({name:`Märta ${i}`,definition:'Adult.',intro:'Straße',tags:['Grün'],favorite:i%2===0});
  const first=a.queryCharacters({q:'Marta',limit:24,sort:'name'}),second=a.queryCharacters({q:'Marta',offset:24,limit:24,sort:'name'});
  assert.equal(first.total,29);assert.equal(first.hasMore,true);assert.equal(second.items.length,5);assert.equal(new Set([...first.items,...second.items].map(c=>c.id)).size,29);assert.equal(first.items[0].definition,undefined);
  assert.equal(a.queryCharacters({q:'strasse',favorites:true,tag:'grun'}).total,15);
  assert.throws(()=>a.queryCharacters({limit:101}),{code:'invalid'});assert.throws(()=>a.updateDefinition('character',draft.id,{gender:'inferred'}),{code:'invalid'});assert.throws(()=>a.updateDefinition('character',draft.id,{opening:'x'.repeat(12001)}),{code:'invalid'});
 }finally{a.close();}
});

test('old character records and legacy transfer preserve transcripts without retroactive intro',()=>{
 const a=new Store(':memory:'),b=new Store(':memory:');try{
 const c={id:'legacy',name:'Original legacy',definition:'Adult.',opening:'Old opening',version:1,createdAt:'2026-01-01'};
 a.db.prepare('INSERT INTO library VALUES(?,?,?)').run(c.id,'character',JSON.stringify(c));
 const p=a.createPersona({name:'Visitor',definition:'Adult.'});const s=a.createStory({characterId:c.id,personaId:p.id,title:'Legacy'});assert.equal(s.messages.length,1);assert.equal(s.character.intro,'');
 const data=exportData(a);delete data.library[0].data.intro;importData(b,data);assert.equal(b.getStory(s.id).messages.length,1);assert.equal(b.definition(c.id,'character').gender,'unspecified');
 }finally{a.close();b.close();}
});

test('selector library summaries omit definitions and narrative from library and story snapshots',()=>{
 const a=new Store(':memory:');try{
 const c=a.createCharacter({name:'Original botanist',definition:'PRIVATE_BEHAVIOR',intro:'PRIVATE_INTRO',opening:'PRIVATE_OPENING'}),p=a.createPersona({name:'Visitor',definition:'PRIVATE_PERSONA'});a.createStory({characterId:c.id,personaId:p.id,title:'Original title'});
 const summary=a.library({summary:true}),encoded=JSON.stringify(summary);for(const marker of ['PRIVATE_BEHAVIOR','PRIVATE_INTRO','PRIVATE_OPENING','PRIVATE_PERSONA'])assert.ok(!encoded.includes(marker));
 assert.equal(summary.characters[0].name,c.name);assert.equal(summary.stories[0].character.id,c.id);assert.equal(summary.personas[0].id,p.id);assert.equal(a.library().characters[0].definition,'PRIVATE_BEHAVIOR');
 }finally{a.close();}
});
