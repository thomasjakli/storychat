import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../store.mjs';
import {exportData,importData,validateTransfer,MAX_TRANSFER_BYTES} from '../transfer.mjs';

const empty={reply:'The archive remains open.',memories:[],threads:[],relationship:[],thoughts:[],scene:null};
function fixture(t){
  const source=new Store(':memory:'),target=new Store(':memory:');
  t.after(()=>{source.close();target.close();});
  const c=source.createCharacter({name:'Synthetic archivist',definition:'An original adult archivist.'});
  const p=source.createPersona({name:'Synthetic visitor',definition:'An original adult visitor.'});
  const created=source.createStory({characterId:c.id,personaId:p.id,title:'Long archive'});
  const story=source.load(created.id);
  for(let n=0;n<40;n++)story.messages.push({id:`source-${n}`,role:'user',text:`Original synthetic archive evidence ${n}.`,createdAt:'2026-11-05T00:00:00.000Z'});
  const record=n=>({id:`memory-${n}`,key:`archive.${n}`,text:`Original archive entry ${n}. `+'synthetic '.repeat(145),sources:['source-0'],revision:0});
  story.memories=Array.from({length:6000},(_,n)=>({...record(n),kind:'fact',pinned:false,corrected:false}));
  // Accumulated duplicate-fact provenance exceeds the per-model-response limit.
  story.memories[0].sources=story.messages.map(m=>m.id);
  for(const category of ['threads','relationship','thoughts'])story[category]=Array.from({length:500},(_,n)=>({...record(n),id:`${category}-${n}`,...(category==='threads'?{status:n%2?'pending':'completed'}:{})}));
  source.save(story);
  return {source,target,id:story.id};
}

test('large portable notebooks preserve thousands of records and all accumulated evidence above 8 MiB',t=>{
  const f=fixture(t),data=exportData(f.source);
  assert.ok(Buffer.byteLength(JSON.stringify(data))>8*1024*1024);
  importData(f.target,data);
  const restored=f.target.load(f.id);
  assert.deepEqual(restored,f.source.load(f.id));
  assert.equal(restored.memories[0].sources.length,40);
  assert.equal(restored.threads.length,500);
});

test('lossless large-state transfer retains latest replacement snapshot and can regenerate after recovery',t=>{
  const f=fixture(t),attempt=f.source.beginTurn(f.id,{requestId:'large-turn',text:'Continue this synthetic archive scene.'});
  f.source.finishTurn(f.id,attempt.generation.id,empty);
  const data=exportData(f.source,{includeHistory:true});
  importData(f.target,data);
  const replacement=f.target.beginReplacement(f.id,{requestId:'recovered-replacement',generationId:attempt.generation.id,revision:f.target.getStory(f.id).revision});
  f.target.finishTurn(f.id,replacement.generation.id,empty);
  assert.equal(f.target.getStory(f.id).memories.length,6000);
  assert.equal(f.target.getStory(f.id).generations.at(-1).status,'completed');
});

test('large-state imports reject missing, cross-story and thought source references without partial writes',t=>{
  const f=fixture(t),data=exportData(f.source);
  for(const badSource of ['missing-source','another-story-source','private-thought']){
    const changed=structuredClone(data);
    changed.stories[0].messages.push({id:'private-thought',role:'assistant',kind:'thought',origin:'generated',text:'An authored private thought.',sources:['source-0'],createdAt:'2026-11-05T00:00:00.000Z'});
    changed.stories[0].memories[0].sources.push(badSource);
    assert.throws(()=>importData(f.target,changed),{code:'invalid'});
    assert.equal(f.target.library().characters.length,0);
    assert.equal(f.target.library().stories.length,0);
  }
});

test('portable transfer byte ceiling reports an actionable recovery error',()=>{
  assert.throws(()=>validateTransfer({format:'storychat',padding:'x'.repeat(MAX_TRANSFER_BYTES)}),{code:'transfer_limit'});
});
