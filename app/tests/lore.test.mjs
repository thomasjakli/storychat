import test from 'node:test';
import assert from 'node:assert/strict';
import {Store,validateOutput} from '../store.mjs';
import {exportData,importData,validateTransfer} from '../transfer.mjs';
const empty={reply:'A quiet moment.',memories:[],threads:[],relationship:[],thoughts:[],scene:null};
function fixture(t){const store=new Store(':memory:');t.after(()=>store.close());const c=store.createCharacter({name:'Lina',definition:'An adult archivist.'}),p=store.createPersona({name:'Ari',definition:'An adult traveler.'});const create=()=>store.createStory({characterId:c.id,personaId:p.id,title:'Archive'});return {store,story:create(),other:create()};}
test('lore is isolated background, survives recovery, and never becomes evidence by saving',t=>{
 const {store,story,other}=fixture(t);const data={revision:0,title:'The Glass Guild',text:'A secret organization of archivists.'};
 const saved=store.setLore(story.id,'guild',data);assert.equal(saved.messages.length,0);assert.equal(saved.memories.length,0);assert.equal(saved.revision,1);assert.deepEqual(store.getStory(other.id).lore,[]);
 assert.equal(store.setLore(story.id,'guild',data).revision,1);
 const a=store.beginTurn(story.id,{requestId:'turn',text:'I open the archive door.'});assert.equal(a.context.lore[0].title,data.title);assert.ok(!a.context.sourceIds.includes('guild'));
 assert.throws(()=>validateOutput({...empty,memories:[{kind:'event',key:'guild',text:'The guild arrived.',sources:['guild']}]},a.context.sourceIds));
 store.finishTurn(story.id,a.generation.id,empty);
 for(const includeHistory of [false,true]){const backup=exportData(store,{includeHistory});const restored=new Store(':memory:');try{importData(restored,backup);assert.deepEqual(restored.getStory(story.id).lore,saved.lore);}finally{restored.close();}}
 const old=exportData(store);for(const s of old.stories)delete s.lore;assert.doesNotThrow(()=>validateTransfer(old));
});
test('lore edits reject pending or stale work and survive latest reply replacement',t=>{
 const {store,story}=fixture(t);store.setLore(story.id,'guild',{revision:0,title:'Guild',text:'Keeps maps.'});
 assert.throws(()=>store.setLore(story.id,'guild',{revision:0,title:'Guild',text:'Other maps.'}),{code:'conflict'});
 const a=store.beginTurn(story.id,{requestId:'first',text:'Hello'});
 assert.throws(()=>store.setLore(story.id,'new',{revision:1,title:'New',text:'Background'}),{code:'conflict'});
 store.failTurn(story.id,a.generation.id);let s=store.getStory(story.id);s=store.setLore(story.id,'guild',{revision:s.revision,title:'Guild',text:'Keeps rare maps.'});
 const r=store.beginReplacement(story.id,{generationId:a.generation.id,revision:s.revision,requestId:'replace'});assert.equal(r.context.lore[0].text,'Keeps rare maps.');
 s=store.finishTurn(story.id,r.generation.id,empty);s=store.setLore(story.id,'guild',{revision:s.revision},true);assert.deepEqual(s.lore,[]);assert.equal(store.setLore(story.id,'guild',{revision:0},true).revision,s.revision);
});
test('lore validates size, fields and malicious recovery records atomically',t=>{
 const {store,story}=fixture(t);for(const fields of [{title:'',text:'x'},{title:'Title',text:'x'.repeat(12001)},{title:'Title',text:'x',sources:['fake']}])assert.throws(()=>store.setLore(story.id,'entry',{revision:0,...fields}),{code:'invalid'});
 for(let i=0;i<2;i++)store.setLore(story.id,'entry-'+i,{revision:i,title:'Entry',text:'x'.repeat(11900)});
 assert.throws(()=>store.setLore(story.id,'overflow',{revision:2,title:'Entry',text:'x'.repeat(11900)}),{code:'invalid'});assert.equal(store.getStory(story.id).lore.length,2);
 const backup=exportData(store);backup.stories.find(s=>s.id===story.id).lore[0].sources=['fake'];assert.throws(()=>validateTransfer(backup),{code:'invalid'});
});


test('long lore survives context and portable recovery without truncation',t=>{
 const {store,story}=fixture(t);const text='界'.repeat(12000);
 store.setLore(story.id,'long',{revision:0,title:'Long background',text});
 assert.equal(store.buildContext(store.load(story.id)).lore[0].text,text);
 const restored=new Store(':memory:');try{importData(restored,exportData(store));assert.equal(restored.getStory(story.id).lore[0].text,text);}finally{restored.close();}
});
