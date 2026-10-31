import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../store.mjs';
import {exportData,importData,validateTransfer} from '../transfer.mjs';
const empty=reply=>({reply,memories:[],threads:[],relationship:[],thoughts:[],scene:null});
function setup(s){const c=s.createCharacter({name:'Tarin',definition:'An original adult watchmaker.',opening:'The workshop door is open.'}),p=s.createPersona({name:'Rin',definition:'An original adult visitor.'});return s.createStory({characterId:c.id,personaId:p.id,title:'Workshop'});}
test('reserved reply source persists once, validates backup and rejects foreign missing source IDs',()=>{
 const s=new Store(':memory:'),target=new Store(':memory:');try{const story=setup(s),a=s.beginTurn(story.id,{requestId:'qa-source',text:'I wait by the bench.'});
 assert.equal(a.context.replySourceId,a.generation.assistantMessageId);assert.ok(a.context.sourceIds.includes(a.context.replySourceId));assert.ok(!a.context.messages.some(m=>m.id===a.context.replySourceId));
 const bad={...empty('Tarin opens a brass drawer.'),memories:[{kind:'event',key:'drawer.open',text:'Tarin opened a brass drawer.',sources:['foreign-missing']}]};
 assert.throws(()=>s.finishTurn(story.id,a.generation.id,bad));assert.equal(s.getStory(story.id).messages.length,story.messages.length+1);assert.equal(s.getStory(story.id).memories.length,0);
 const out={...empty('Tarin opens a brass drawer.'),memories:[{kind:'event',key:'drawer.open',text:'Tarin opened a brass drawer.',sources:[a.context.replySourceId]}]};
 const done=s.finishTurn(story.id,a.generation.id,out);assert.equal(done.messages.at(-1).id,a.context.replySourceId);assert.equal(done.memories[0].sources[0],done.messages.at(-1).id);
 s.finishTurn(story.id,a.generation.id,out);assert.equal(s.getStory(story.id).messages.length,done.messages.length);
 const backup=exportData(s,{includeHistory:true});validateTransfer(backup);importData(target,backup);assert.deepEqual(target.getStory(story.id).memories,done.memories);
 const forged=structuredClone(backup);forged.stories[0].generations[0].context.sourceIds.push('arbitrary-missing');assert.throws(()=>validateTransfer(forged));
 }finally{s.close();target.close();}
});
test('reserved source replacement removes stale events and keeps unrelated owner corrections',()=>{
 const s=new Store(':memory:');try{const story=setup(s),a=s.beginTurn(story.id,{requestId:'qa-old',text:'What is on the bench?'});
 const done=s.finishTurn(story.id,a.generation.id,{...empty('A clock bell rings.'),memories:[{kind:'event',key:'bell',text:'A clock bell rang.',sources:[a.context.replySourceId]},{kind:'fact',key:'tea',text:'The visitor likes tea.',sources:[a.generation.userMessageId]}]});
 const corrected=s.editMemory(story.id,done.memories.find(m=>m.key==='tea').id,{text:'The visitor likes cocoa.',pinned:true});
 const r=s.beginReplacement(story.id,{requestId:'qa-new',generationId:a.generation.id,revision:corrected.revision,text:'Is it quiet here?'});assert.notEqual(r.context.replySourceId,a.context.replySourceId);
 const after=s.finishTurn(story.id,r.generation.id,empty('Tarin closes the window.'));assert.ok(!after.memories.some(m=>m.key==='bell'));assert.ok(after.memories.some(m=>m.text==='The visitor likes cocoa.'&&m.pinned&&m.corrected));assert.ok(after.messages.find(m=>m.id===a.context.replySourceId).superseded);
 }finally{s.close();}
});
test('recent narrative context keeps latest complete messages within count and text budgets',()=>{
 const s=new Store(':memory:');try{const story=setup(s);for(let i=0;i<9;i++){const a=s.beginTurn(story.id,{requestId:'context-'+i,text:'Question '+i+' '+'.'.repeat(1900)});s.finishTurn(story.id,a.generation.id,empty('Answer '+i+' '+'.'.repeat(1900)));}
 const raw=s.load(story.id),context=s.buildContext(raw);assert.ok(context.messages.length>6);assert.ok(context.messages.length<=12);assert.ok(context.messages.reduce((n,m)=>n+m.text.length,0)<=24000);assert.equal(context.messages.at(-1).id,raw.messages.at(-1).id);assert.ok(context.messages.every(m=>raw.messages.some(original=>original.id===m.id&&original.text===m.text)));
 }finally{s.close();}
});
test('legacy six-message lossless contexts above new budget remain importable',()=>{
 const s=new Store(':memory:');try{const story=setup(s);for(let i=0;i<3;i++){const a=s.beginTurn(story.id,{requestId:'legacy-'+i,text:'Q'+i+'.'.repeat(5000)});s.finishTurn(story.id,a.generation.id,empty('A'+i+'.'.repeat(5000)));}
 const backup=exportData(s,{includeHistory:true}),v=backup.stories[0];for(const g of v.generations){const reserved=g.assistantMessageId;delete g.assistantMessageId;delete g.context.replySourceId;g.context.sourceIds=g.context.sourceIds.filter(id=>id!==reserved);}
 const legacy=v.generations.at(-1);legacy.context.messages=structuredClone(v.messages.slice(0,6));legacy.context.sourceIds=legacy.context.messages.map(m=>m.id);assert.ok(legacy.context.messages.reduce((n,m)=>n+m.text.length,0)>24000);validateTransfer(backup);
 }finally{s.close();}
});
