import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../store.mjs';

const empty = () => ({reply:'The next moment unfolds.',memories:[],threads:[],relationship:[],thoughts:[],scene:null});
function fixture(t) {
  const store = new Store(':memory:'); t.after(() => store.close());
  const character = store.createCharacter({name:'Iris',definition:'An adult archivist.'});
  const persona = store.createPersona({name:'Ash',definition:'An adult traveller.'});
  const story = store.createStory({characterId:character.id,personaId:persona.id,title:'Synthetic archive'});
  const attempt = store.beginTurn(story.id,{requestId:'seed',text:'The old amethyst compass is kept in the lighthouse.'});
  store.finishTurn(story.id,attempt.generation.id,empty());
  return {store,id:story.id,source:attempt.generation.userMessageId};
}
function seed(f,count=4000) {
  f.store.change(f.id,story => {
    story.memories = Array.from({length:count},(_,i) => ({id:'memory-'+i,key:'record.'+i,kind:'fact',text:`Archive record ${i} concerns an unrelated distant station.`,sources:[f.source],revision:i,pinned:false,corrected:false}));
    story.memories[0].text = 'The amethyst compass is kept in the lighthouse.';
    story.threads = Array.from({length:300},(_,i) => ({id:'thread-'+i,key:'plan.'+i,text:`Visit station ${i}.`,status:i===0?'pending':'completed',sources:[f.source],revision:i}));
    story.relationship = Array.from({length:150},(_,i) => ({id:'relationship-'+i,key:'relationship.'+i,text:`Trust developed through station ${i}.`,sources:[f.source],revision:i}));
    story.thoughts = Array.from({length:150},(_,i) => ({id:'thought-'+i,key:'thought.'+i,text:`I wonder about station ${i}.`,sources:[f.source],revision:i}));
    story.memories[1].pinned = true; story.memories[2].corrected = true;
    story.suppression.push({key:'forbidden',text:'obsolete location',reason:'correction'});
    story.summary = 'obsolete location';
  });
}

test('thousands of durable records continue replying with bounded relevant/protected evidence',t => {
  const f=fixture(t);seed(f);
  const {context,generation}=f.store.beginTurn(f.id,{requestId:'large',text:'Where is the amethyst compass?'});
  assert.ok(context.memories.some(m=>m.id==='memory-0'));
  assert.ok(context.memories.some(m=>m.id==='memory-1'));
  assert.ok(context.memories.some(m=>m.id==='memory-2'));
  assert.ok(context.threads.some(m=>m.id==='thread-0'));
  assert.ok(context.memories.length<4000);
  assert.ok(JSON.stringify(context).length<=120000);
  assert.ok(Buffer.byteLength(JSON.stringify(context))<=128000);
  assert.match(context.summary,/amethyst compass/);
  assert.doesNotMatch(context.summary,/obsolete location/);
  assert.ok(context.suppression.some(s=>s.key==='forbidden'));
  const output=empty();
  output.memories.push({kind:'belief',key:'new',text:'Ash may enjoy maps.',sources:[generation.userMessageId]});
  for(const category of ['threads','relationship','thoughts']) output[category].push({key:'new',text:'A newly authored development.',sources:[generation.assistantMessageId],...(category==='threads'?{status:'pending'}:{})});
  const completed=f.store.finishTurn(f.id,generation.id,output);
  assert.equal(completed.memories.length,4001);
  assert.equal(completed.threads.length,301);
  assert.equal(completed.relationship.length,151);
  assert.equal(completed.thoughts.length,151);
  assert.equal(completed.generations.at(-1).status,'completed');
  assert.equal(f.store.load(f.id).generations.filter(g=>g.baseSnapshot).length,1);
  assert.equal(f.store.load(f.id).generations.filter(g=>g.context).length,1);
  const replay=f.store.beginTurn(f.id,{requestId:'seed',text:'The old amethyst compass is kept in the lighthouse.'});
  assert.equal(replay.generation.status,'completed');
  assert.equal(replay.context,undefined);
});

test('equivalent repeated facts retain every source while model projections remain bounded',t => {
  const f=fixture(t);
  for(let i=0;i<20;i++) {
    const a=f.store.beginTurn(f.id,{requestId:'duplicate-'+i,text:'I collect blue stones.'});
    const out=empty();out.memories=[{kind:'fact',key:'stones',text:'Ash collects blue stones.',sources:[a.generation.userMessageId]}];
    f.store.finishTurn(f.id,a.generation.id,out);
  }
  const memory=f.store.getStory(f.id).memories[0];
  assert.equal(memory.sources.length,20);
  const c=f.store.beginTurn(f.id,{requestId:'inspect',text:'What stones do I collect?'}).context;
  assert.equal(c.memories.length,1);
  assert.equal(c.memories[0].sources.length,16);
  assert.equal(f.store.getStory(f.id).memories[0].sources.length,20);
});

test('protected evidence overflow fails before persisting a turn rather than silently truncating',t=>{
  const f=fixture(t);seed(f,100);
  f.store.change(f.id,story=>{for(const m of story.memories){m.pinned=true;m.text='界'.repeat(1900);}});
  const before=f.store.getStory(f.id);
  assert.throws(()=>f.store.beginTurn(f.id,{requestId:'overflow',text:'Continue.'}),{code:'context_limit'});
  assert.deepEqual(f.store.getStory(f.id),before);
});

test('context whitelist excludes unselected historical evidence and retains conflicting alternatives',t=>{
  const f=fixture(t);seed(f);
  f.store.change(f.id,s=>{
    s.messages.unshift({id:'unselected-source',role:'user',text:'Unrelated old detail.',createdAt:'2026-01-01'});
    s.memories.at(-1).sources=['unselected-source'];s.memories.at(-1).text='z'.repeat(2000);s.memories.at(-1).revision=0;
    s.memories.push({id:'alternative',key:'record.0',kind:'fact',text:'The amethyst compass is at the harbor.',sources:[f.source],revision:1});
  });
  // Keep the unique old source outside the recent-message window.
  for(let i=0;i<6;i++){const a=f.store.beginTurn(f.id,{requestId:'padding-'+i,text:'Discuss another evening.'});f.store.finishTurn(f.id,a.generation.id,empty());}
  const context=f.store.beginTurn(f.id,{requestId:'conflict',text:'Where is the amethyst compass?'}).context;
  assert.ok(context.memories.some(m=>m.id==='memory-0'));
  assert.ok(context.memories.some(m=>m.id==='alternative'));
  assert.ok(!context.sourceIds.includes('unselected-source'));
});
