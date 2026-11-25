// Original synthetic fixtures. Never load owner exports in the automated suite.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Store} from '../store.mjs';
import {timelineContext} from '../timeline.mjs';
import {narrativeCues,recallTimeEvidence,activityStartSource} from '../narrative-time.mjs';
import {exportData,importData,validateTransfer} from '../transfer.mjs';

const m=(id,text,role='user',extra={})=>({id,text,role,createdAt:'2001-01-01T00:00:00.000Z',...extra});
const clock=messages=>timelineContext({messages});
const blank={reply:'The workshop is quiet.',memories:[],threads:[],relationship:[],thoughts:[],scene:null,storyTime:null};

test('affirmed morning transitions survive unrelated negation and long separable verbs',()=>{
  for(const morning of [
    '*Morgens wachen die beiden erstaunlich ruhig und gut erholt auf.*',
    '*Am folgenden Morgen ist die Kälte nicht mehr so streng.*',
    '*The next morning, the paint is not dry yet.*',
    '*Am darauffolgenden Morgen bin ich noch nicht ganz munter.*',
    '*The morning after, the rain has not stopped.*',
  ]){
    const c=clock([m('bed','*Es wird Abend. Wir gehen schlafen.*'),m('morning',morning)]);
    assert.equal(c.current.storyDay,2,morning);
  }
});

test('negated sleep, hypothetical waking and recollections do not become events',()=>{
  for(const hypothetical of [
    '*Sie hat Angst, dass sie morgens aufwacht und die Werkstatt verschwunden ist.*',
    '*He worries that he might wake up the next morning alone.*',
    '*Ich schlafe heute nicht ein.*',
    '*She does not wake up.*',
    '*I remember the following morning, when we woke up.*',
    '*We plan to wake up the next morning.*',
    '*Morgen wachen wir früh auf.*',
    '*Every morning we wake up before sunrise.*',
  ])assert.deepEqual(narrativeCues(m('hypothesis',hypothetical)),[],hypothetical);
});

test('sleep is not classified as a nap solely because a long-ago phase was morning',()=>{
  const messages=[m('a','*Morning sunlight reaches the desk.*'),...Array.from({length:12},(_,i)=>m('work-'+i,'*We examine the mosaic pieces.*')),m('bed','*We go to sleep.*'),m('wake','*Morgens wachen wir wieder auf.*')];
  assert.equal(clock(messages).current.storyDay,2);
  const fresh=[m('a','*In the afternoon, I fall asleep.*'),m('b','*I wake up.*')];
  assert.equal(clock(fresh).current.storyDay,1);
});

test('explicit short sleep prevents an extra day even when no word for nap is used',()=>{
  for(const duration of ['Nach neunzig Minuten','Nach einer halben Stunde','Nach ein einhalb Stunden','After half an hour','After 1.5 hours']){
    const messages=[m('a','*It is evening.*'),m('b',`*I fall asleep. ${duration} I wake up and return to the desk.*`)];
    assert.equal(clock(messages).current.storyDay,1,duration);
  }
  const multiple=[m('a','*In the afternoon I fall asleep. After 30 minutes I wake up. We eat dinner and go to bed. At daybreak I wake up.*')];
  assert.equal(clock(multiple).current.storyDay,2,'The short interval must not suppress a later overnight interval');
});

test('related nouns and adjectives are not conjugations of waking or sleeping',()=>{
  const messages=[m('a','*It is evening.*'),m('b','*Die Erwachsenen bleiben wachsam. Die Pflanzen sollen prächtig aufwachsen. Ein schlaftrunkener Besucher trägt eine Kiste herein.*')];
  assert.deepEqual(narrativeCues(messages[1]),[]);
  assert.equal(clock(messages).current.storyDay,1);
});

test('meal actions, daybreak and day-after wording keep day phases in order',()=>{
  const messages=[m('a','*We eat lunch.*'),m('b','*We eat dinner and go to sleep.*'),m('c','*At daybreak, we wake up.*'),m('d','*Zum Abendessen gehen wir in die Küche. Dann schlafen wir ein.*'),m('e','*Am Tag darauf öffne ich meine Augen.*')];
  assert.equal(clock(messages).current.storyDay,3);
});

function syntheticHistory(){
  const messages=[m('breakfast','*I begin preparing breakfast at the table.*'),m('proposal','I intend to start restoring the mosaic next week.'),m('layout','*I spread out the mosaic pieces on the workbench.*'),m('work-start','*I begin restoring the mosaic. The chipped corners need patient attention.*')];
  const mornings=[
    '*Am nächsten Morgen erwache ich beim Klang der Glocke.*',
    '*Morgens wachen die beiden langsam und nach und nach auf.*',
    '*Am folgenden Morgen ist der Himmel noch nicht wolkenfrei.*',
    '*The morning after, I am not ready to leave the workshop.*',
  ];
  for(let i=0;i<4;i++){
    messages.push(m('dinner-'+i,'*We eat dinner, put the brushes away and go to bed.*','assistant',{storyTime:null}),m('dawn-'+i,mornings[i]));
    if(i===0)messages.push(m('phase-two','*I begin part two of the work. The mosaic now needs new grout.*'));
    if(i===2)messages.push(m('brief-sleep','*I fall asleep at the desk. After 30 minutes I wake up and fetch water.*'));
    for(let j=0;j<8;j++)messages.push(m(`work-${i}-${j}`,'*I sort the mosaic pieces and clean the brushes.*',j%2?'assistant':'user'));
  }
  return messages;
}

test('whole-project, preparation and explicitly requested later phase retain distinct starts',()=>{
  const story={messages:syntheticHistory(),suppression:[]},c=timelineContext(story);
  for(const [query,expected,age] of [
    ['*I eat breakfast.* How many days have I been restoring the mosaic?','work-start',4],
    ['How many days since I spread out the mosaic pieces?','layout',4],
    ['How many days since I began part two of the mosaic?','phase-two',3],
  ]){
    const evidence=recallTimeEvidence(story,c,query),selected=activityStartSource(evidence,query);
    assert.equal(selected,expected,query);
    assert.equal(evidence.find(e=>e.sourceId===selected).dayChangesSinceEvidence,age);
    assert.ok(!evidence.some(e=>e.sourceId==='breakfast'));
  }
});

test('original onset remains selected when later phases and progress repeat more query terms',()=>{
  const messages=[m('origin','*I begin restoring the mosaic.*'),m('bed','*It is evening. I fall asleep.*'),m('dawn','*The next morning I wake up.*')];
  for(let i=0;i<30;i++)messages.push(m('phase-'+i,'*I begin part two of the mosaic work. The mosaic pieces and grout look promising.*'));
  messages.push(m('retrospective','"You only started the mosaic today," she guesses.','assistant'));
  const story={messages,suppression:[]},query='How many days have I worked on the mosaic, its pieces and grout?';
  const evidence=recallTimeEvidence(story,timelineContext(story),query);
  assert.equal(activityStartSource(evidence,query),'origin');
  assert.equal(evidence[0].sourceId,'origin');
});

test('unrelated question narration and estimates cannot become a project start',()=>{
  const story={messages:[m('unrelated','*I begin arranging dinner at the table.*'),m('plan','I will begin restoring the clock tomorrow. It could take ten days.'),m('origin','*I begin restoring the clock. The case is dusty.*'),m('bed','*We eat dinner and fall asleep.*'),m('wake','*The following morning, I am not tired.*')],suppression:[]};
  const query='*I eat dinner at the table.* How long have I been restoring the clock?';
  const evidence=recallTimeEvidence(story,timelineContext(story),query);
  assert.equal(activityStartSource(evidence,query),'origin');
  assert.equal(evidence.find(e=>e.sourceId==='origin').dayChangesSinceEvidence,1);
  assert.ok(!evidence.some(e=>e.sourceId==='unrelated'));
});

test('a proposed or questioned later phase is not evidence that the phase has started',()=>{
  const story={messages:[m('plan','I plan to start part two of the clock work tomorrow.'),m('future','Ich werde mit Teil zwei der clock work anfangen.'),m('command','Begin part two of the clock work.','assistant'),m('question','Should we start part two of the clock work?'),m('start','*I begin part two of the clock work. The new bearings are ready.*')],suppression:[]};
  const query='How long have I been doing part two of the clock work?';
  const evidence=recallTimeEvidence(story,timelineContext(story),query);
  assert.equal(activityStartSource(evidence,query),'start');
});

test('v2 startup rebuild, full request context and portable recovery preserve the corrected interpretation',t=>{
  const dir=mkdtempSync(join(tmpdir(),'storychat-v3-synthetic-')),path=join(dir,'story.sqlite');
  let store=new Store(path);t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
  const c=store.createCharacter({name:'Mina',definition:'An original adult ceramic artist.'}),p=store.createPersona({name:'Theo',definition:'An original adult conservator.'});
  const id=store.createStory({title:'Synthetic mosaic restoration',characterId:c.id,personaId:p.id}).id;
  const story=store.load(id);story.messages=syntheticHistory();story.timeline={version:2,points:[]};
  story.memories=[{id:'pinned-origin',key:'mosaic',kind:'event',text:'The conservator began restoring the mosaic.',sources:['work-start'],revision:0,pinned:true,corrected:true}];
  store.db.prepare('UPDATE stories SET data=? WHERE id=?').run(JSON.stringify(story),id);store.close();store=new Store(path);
  const rebuilt=store.load(id);assert.equal(rebuilt.timeline.version,3);assert.equal(rebuilt.timeline.points.at(-1).storyDay,5);
  assert.deepEqual(rebuilt.messages,story.messages);assert.deepEqual(rebuilt.memories,story.memories);assert.equal(rebuilt.revision,story.revision);
  const attempt=store.beginTurn(id,{requestId:'elapsed-query',text:'How many days have I been restoring the mosaic?'});
  assert.equal(attempt.context.timeline.activityStartSourceId,'work-start');
  assert.ok(!attempt.context.messages.some(m=>m.id==='work-start'));
  assert.ok(attempt.context.sourceIds.includes('work-start'));
  store.finishTurn(id,attempt.generation.id,blank);
  const backup=exportData(store,{includeHistory:true}),target=new Store(':memory:');t.after(()=>target.close());importData(target,backup);
  assert.equal(target.getStory(id).timeline.points.at(-1).storyDay,5);
  const forged=structuredClone(backup);forged.stories[0].generations.at(-1).context.timeline.activityStartSourceId='missing';
  assert.throws(()=>validateTransfer(forged),{code:'invalid'});
  const persisted=store.db.prepare('SELECT data FROM stories WHERE id=?').get(id).data;store.close();store=new Store(path);
  assert.equal(store.db.prepare('SELECT data FROM stories WHERE id=?').get(id).data,persisted);
});
