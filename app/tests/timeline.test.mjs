import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Store,validateOutput} from '../store.mjs';
import {buildTimeline,reconstructTime,timelineContext,evidenceTimes} from '../timeline.mjs';
import {exportData,importData,validateTransfer} from '../transfer.mjs';

const blank=()=>({reply:'The room is quiet.',memories:[],threads:[],relationship:[],thoughts:[],scene:null,storyTime:null});
const step=(sources,extra={})=>({advanceMinutes:0,date:null,time:null,label:'The current moment',sources,...extra});
const message=(id,text,extra={})=>({id,role:'user',text,createdAt:'2000-01-01T00:00:00Z',...extra});
function fixture(t,disk=false){
  const dir=mkdtempSync(join(tmpdir(),'storychat-time-')),path=disk?join(dir,'story.sqlite'):':memory:';
  const f={store:new Store(path),path};
  const c=f.store.createCharacter({name:'Ada',definition:'An original adult botanist.'}),p=f.store.createPersona({name:'Ren',definition:'An original adult visitor.'});
  f.id=f.store.createStory({title:'The winter garden',characterId:c.id,personaId:p.id}).id;
  t.after(()=>{f.store.close();rmSync(dir,{recursive:true,force:true});});return f;
}
function turn(f,text,make=()=>blank()){
  const a=f.store.beginTurn(f.id,{requestId:crypto.randomUUID(),text});
  return {attempt:a,story:f.store.finishTurn(f.id,a.generation.id,make(a.generation.userMessageId,a.generation.assistantMessageId))};
}

test('relative time advances through midnight, and real session gaps never advance fiction',()=>{
  const story={messages:[message('a','Story time: 2026-11-25 23:30'),message('b','2 hours later.',{createdAt:'2099-01-01T00:00:00Z'}),message('c','We keep talking.')]};
  const clock=timelineContext(story);
  assert.equal(clock.current.date,'2026-11-26');assert.equal(clock.current.time,'01:30');
  const evidence=evidenceTimes([{id:'plan',sources:['c','a']}],clock)[0];
  assert.equal(evidence.sourceId,'a');assert.equal(evidence.minutesSinceEvidence,120);assert.equal(evidence.calendarDaysSinceEvidence,1);
});

test('activities can accumulate explicit elapsed time without any calendar anchor',()=>{
  const story={messages:[message('a','We start waiting.'),message('b','*Two hours later*'),message('c','*Drei Tage später*')]};
  const evidence=evidenceTimes([{id:'wait',sources:['a']}],timelineContext(story))[0];
  assert.equal(evidence.minutesSinceEvidence,4440);assert.equal(evidence.firstEvidencedAt.date,null);
  story.messages.push(message('d','*The next morning*'));
  assert.equal(evidenceTimes([{id:'wait',sources:['a']}],timelineContext(story))[0].minutesSinceEvidence,null);
});

test('conservative reconstruction ignores quoted dates, plans, thoughts and unsupported natural language',()=>{
  for(const text of ['I promise to return in 2 hours.','She recalls 2026-11-20 at 08:30.','"2 days later."','Tomorrow we could go.','It is Monday morning.'])assert.equal(reconstructTime(message('a',text)),null);
  assert.equal(reconstructTime(message('a','Story time: 2026-02-30 10:00')),null);
  assert.equal(reconstructTime(message('a','3 days later.',{kind:'thought'})),null);
  assert.equal(reconstructTime(message('a','*3 Stunden später*')).advanceMinutes,180);
  assert.equal(reconstructTime(message('a','Szenenzeit: Montagmorgen')).date,null);
});

test('unknown gaps and backward clocks break exact duration continuity; date-only differences retain day precision',()=>{
  let story={messages:[message('a','Story time: 2026-11-25 12:00'),message('b','Story time: Some time later')]};
  assert.equal(evidenceTimes([{id:'x',sources:['a']}],timelineContext(story))[0].minutesSinceEvidence,null);
  story.messages[1]=message('b','Story time: 2026-11-26');
  let evidence=evidenceTimes([{id:'x',sources:['a']}],timelineContext(story))[0];
  assert.equal(evidence.minutesSinceEvidence,null);assert.equal(evidence.calendarDaysSinceEvidence,1);
  story.messages[1]=message('b','Story time: 2026-11-24 12:00');
  evidence=evidenceTimes([{id:'x',sources:['a']}],timelineContext(story))[0];assert.equal(evidence.minutesSinceEvidence,null);
  story.messages[1]=message('b','Earlier in the day.',{storyTime:{...step(['b'],{time:'10:00'}),origin:'model'}});
  evidence=evidenceTimes([{id:'x',sources:['a']}],timelineContext(story))[0];assert.equal(evidence.minutesSinceEvidence,null);
});

test('new checkpoints persist, preserve thread onset evidence and survive context eviction and recovery',t=>{
  const f=fixture(t);
  const original=turn(f,'Story time: 2026-11-25 08:00',(source)=>({...blank(),threads:[{key:'wait',text:'We start waiting for the gardener.',status:'pending',sources:[source]}]}));
  turn(f,'2 hours later.',source=>({...blank(),threads:[{key:'wait',text:'We are still waiting for the gardener.',status:'pending',sources:[source]}]}));
  for(let i=0;i<7;i++)turn(f,'We discuss seed variety '+i+'.');
  const context=f.store.buildContext(f.store.load(f.id));
  assert.ok(!context.messages.some(m=>m.id===original.attempt.generation.userMessageId));
  assert.equal(context.timeline.evidence[0].minutesSinceEvidence,120);
  assert.equal(context.threads[0].originSources[0],original.attempt.generation.userMessageId);
  const recovery=exportData(f.store,{includeHistory:true}),target=new Store(':memory:');t.after(()=>target.close());
  importData(target,recovery);assert.deepEqual(target.getStory(f.id).timeline,f.store.getStory(f.id).timeline);
  assert.equal(target.buildContext(target.load(f.id)).timeline.evidence[0].minutesSinceEvidence,120);
});

test('startup backfills legacy transcripts once without inference or changing text, revisions or protected memory',t=>{
  const f=fixture(t,true),legacy=f.store.load(f.id);
  legacy.messages=[message('old-a','Szenenzeit: 2026-11-25 10:00'),message('old-b','*2 Tage später*'),message('old-c','I promise to return tomorrow.')];
  legacy.memories=[{id:'pin',key:'plant',kind:'fact',text:'The fern is green.',sources:['old-a'],revision:0,pinned:true,corrected:true}];
  delete legacy.timeline;f.store.db.prepare('UPDATE stories SET data=? WHERE id=?').run(JSON.stringify(legacy),f.id);
  f.store.close();f.store=new Store(f.path);
  const migrated=f.store.getStory(f.id);assert.equal(migrated.timeline.points.length,2);assert.equal(migrated.timeline.points[1].minute,2880);
  assert.deepEqual(migrated.messages,legacy.messages);assert.deepEqual(migrated.memories,legacy.memories);assert.equal(migrated.revision,0);
  const serialized=f.store.db.prepare('SELECT data FROM stories WHERE id=?').get(f.id).data;
  f.store.close();f.store=new Store(f.path);assert.equal(f.store.db.prepare('SELECT data FROM stories WHERE id=?').get(f.id).data,serialized);
});

test('replacement, retries, invalid output and failed requests cannot leave stale clock changes',t=>{
  const f=fixture(t);turn(f,'Story time: 2026-11-25 10:00');
  const old=turn(f,'We wait.',(source,reply)=>({...blank(),reply:'*Two hours pass.*',storyTime:step([reply],{advanceMinutes:120,label:'Two hours later'})}));
  assert.equal(old.story.timeline.points.at(-1).minute,120);
  const replacement=f.store.beginReplacement(f.id,{requestId:'replace',generationId:old.attempt.generation.id,revision:old.story.revision,text:'We do not wait.'});
  const result=blank();f.store.finishTurn(f.id,replacement.generation.id,result);f.store.finishTurn(f.id,replacement.generation.id,result);
  assert.equal(f.store.getStory(f.id).timeline.points.at(-1).minute,0);
  const failed=f.store.beginTurn(f.id,{requestId:'failed',text:'3 days later.'});
  assert.throws(()=>f.store.finishTurn(f.id,failed.generation.id,{...blank(),storyTime:step(['foreign'],{advanceMinutes:5})}),{code:'invalid'});
  f.store.failTurn(f.id,failed.generation.id);
  assert.equal(f.store.getStory(f.id).timeline.points.at(-1).minute,0);
  const backup=exportData(f.store),target=new Store(':memory:');t.after(()=>target.close());importData(target,backup);
  assert.equal(target.getStory(f.id).timeline.points.at(-1).minute,0);
});

test('structured time validates dates, bounds and sources while legacy model results remain valid',()=>{
  const output=blank();delete output.storyTime;assert.doesNotThrow(()=>validateOutput(output,['a']));
  for(const extra of [{date:'2026-02-30'},{time:'25:00'},{advanceMinutes:-1},{advanceMinutes:0.5},{advanceMinutes:Infinity},{date:'yesterday'},{sources:['foreign']}])assert.throws(()=>validateOutput({...blank(),storyTime:step(['a'],extra)},['a']),{code:'invalid'});
});

test('elapsed evidence preserves the earliest source beyond projection limits and remains within request budgets',t=>{
  const f=fixture(t),original=turn(f,'We start waiting.',source=>({...blank(),memories:[{key:'waiting',kind:'event',text:'We started waiting.',sources:[source]}]}));
  turn(f,'2 hours later.');
  f.store.change(f.id,s=>{
    for(let i=0;i<40;i++){s.messages.push(message('extra-'+i,'We discuss the garden.'));s.memories[0].sources.push('extra-'+i);}
    s.memories[0].pinned=true;
    for(let i=0;i<2000;i++)s.threads.push({id:'plan-'+i,key:'plan.'+i,text:'We are still waiting for seed parcel '+i,status:'pending',sources:[original.attempt.generation.userMessageId],revision:1});
  });
  const context=f.store.buildContext(f.store.load(f.id));
  assert.ok(Buffer.byteLength(JSON.stringify(context))<=128000);
  assert.ok(Buffer.byteLength(JSON.stringify(context.timeline.evidence))<=8000);
  const evidence=context.timeline.evidence.find(e=>e.recordId===context.memories[0].id);
  // Pending plans have priority in the bounded temporal supplement. Without
  // them, the protected memory still uses its complete retained provenance.
  assert.ok(!evidence||evidence.minutesSinceEvidence===120);
  f.store.change(f.id,s=>{s.threads=[];});
  const protectedContext=f.store.buildContext(f.store.load(f.id));
  assert.equal(protectedContext.timeline.evidence[0].sourceId,original.attempt.generation.userMessageId);
  assert.equal(protectedContext.timeline.evidence[0].minutesSinceEvidence,120);
});

test('private thoughts and superseded checkpoints do not change time, and a user skip is not parsed twice',t=>{
  const f=fixture(t);turn(f,'Story time: 2026-11-25 10:00');
  turn(f,'2 hours later.',()=>({...blank(),reply:'2 hours later.'}));
  assert.equal(f.store.getStory(f.id).timeline.points.at(-1).minute,120);
  f.store.change(f.id,s=>s.messages.push(message('thought','5 days later.',{role:'assistant',kind:'thought',origin:'imported',sources:[],provenance:{source:'synthetic',reference:'test'}})));
  assert.equal(f.store.getStory(f.id).timeline.points.at(-1).minute,120);
  const backup=exportData(f.store);backup.stories[0].messages[0].storyTime={...step(['thought']),origin:'model'};
  assert.throws(()=>validateTransfer(backup),{code:'invalid'});
});

test('independent stories have independent clocks',t=>{
  const f=fixture(t);turn(f,'Story time: 2026-11-25 10:00');
  const s=f.store.getStory(f.id),other=f.store.createStory({title:'Another garden',characterId:s.character.id,personaId:s.persona.id});
  assert.equal(f.store.buildContext(f.store.load(other.id)).timeline.current,null);
  assert.equal(buildTimeline({messages:[]}).points.length,0);
});
