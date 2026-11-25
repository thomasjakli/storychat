import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../store.mjs';
import {buildTimeline,timelineContext,evidenceTimes} from '../timeline.mjs';
import {narrativeCues} from '../narrative-time.mjs';
import {exportData,importData,validateTransfer} from '../transfer.mjs';

const m=(id,text,role='assistant',extra={})=>({id,text,role,createdAt:'2000-01-01T00:00:00.000Z',...extra});
const current=messages=>buildTimeline({messages}).points.at(-1);
const blank={reply:'We continue talking.',scene:null,memories:[],threads:[],relationship:[],thoughts:[],storyTime:null};

test('German prose counts nights, not bedtime mentions or adjacent morning echoes',()=>{
  const messages=[
    m('start','*Ich beginne mit der Reparatur des Teleskops.*','user'),
    m('eve','*Es wird Abend. Sie räumt die Werkzeuge weg.*'),
    m('sleep-u','*Ich lege mich ins Bett und schlafe langsam ein.*','user'),
    m('sleep-a','*Er geht ebenfalls ins Bett und schläft ein.*'),
    m('wake-u','*Am nächsten Morgen wache ich auf.*','user'),
    m('wake-a','*Am nächsten Morgen erwacht auch der Mechaniker. Morgenlicht fällt durch das Fenster.*'),
    m('work','*Ich arbeite wieder am Teleskop.*','user'),
    m('eve2','*Am späten Abend gehen beide schlafen.*'),
    m('wake2','*Ich wache auf und hole die Werkzeuge.*','user'),
    m('same','*Er erwacht und öffnet die Augen.*'),
  ];
  assert.equal(current(messages).storyDay,3);
  const clock=timelineContext({messages});
  assert.equal(evidenceTimes([{id:'repair',sources:['start']}],clock)[0].narrativeDayChangesSinceEvidence,2);
  assert.equal(evidenceTimes([{id:'repair',sources:['start']}],clock)[0].minutesSinceEvidence,null);
});

test('English prose recognizes night-to-dawn and repeated waking without inventing dates or hours',()=>{
  const messages=[m('start','*I start restoring the mural.*','user'),m('bed','*It is evening. We go to bed and fall asleep.*'),m('wake','*I wake up. Morning sunlight fills the room.*','user'),m('reply','*She wakes up too, stretching beside the window.*'),m('later','*Evening light fills the room. We go to sleep.*'),m('dawn','*The following morning, she awakens.*')];
  const clock=current(messages);assert.equal(clock.storyDay,3);assert.equal(clock.date,null);assert.equal(clock.time,null);
});

test('naps, midnight waking, closed eyes, quotations, memories, plans and fictional thoughts are not new days',()=>{
  const samples=[
    '*He remembers waking up the next morning.*',
    '*She imagines the next morning.*',
    '*Ich erinnere mich an den nächsten Morgen.*',
    '*Morgen wache ich früh auf.*',
    '*Wenn wir aufwachen, machen wir Frühstück.*',
    '*Er ist nicht eingeschlafen.*',
    '„Am nächsten Morgen wache ich auf“, liest sie vor.',
    '"The next morning we wake up," he says about the plan.',
    '„Eine Geschichte:\nAm nächsten Morgen wache ich auf“, liest sie vor.',
  ];
  for(const text of samples)assert.deepEqual(narrativeCues(m('negative',text)),[],text);
  const messages=[m('a','*It is evening.*'),m('b','*He closes his eyes for a kiss, then opens his eyes.*'),m('c','*In the afternoon, she takes a nap.*'),m('d','*She wakes up.*'),m('e','*Es wird Nacht. Er schläft ein.*'),m('f','*Mitten in der Nacht wacht er auf.*'),m('g','*The next morning she wakes up.*','assistant',{kind:'thought'})];
  assert.equal(current(messages).storyDay,1);
});

test('explicit next-day transitions work without prior bedtime and user-authored second skips are not swallowed',()=>{
  const messages=[m('a','*I start polishing the lens.*','user'),m('b','*The next morning, I return.*','user'),m('c','*The next morning she meets you by the lens.*'),m('d','*The next morning, I return again.*','user')];
  assert.equal(current(messages).storyDay,3);
});

test('same-message sleep/wake cycles retain start/end day positions',()=>{
  const messages=[m('a','*I start a painting. It is evening. I fall asleep. The next morning I paint. It is evening. I go to bed. The following morning I finish the border.*','user')];
  assert.equal(current(messages).storyDay,3);
});

test('explicit skips and model checkpoints are not added to the same overnight transition twice',()=>{
  const messages=[m('a','Story time: 2026-11-25 22:00','user'),m('b','*The next morning, light fills the room.*','assistant',{storyTime:{advanceMinutes:600,date:'2026-11-26',time:'08:00',label:'The following morning',sources:['b'],origin:'model'}}),m('c','*She wakes up and makes tea.*')];
  assert.equal(current(messages).storyDay,2);assert.equal(current(messages).date,'2026-11-26');
  const numbers=[m('a','We begin.'),m('b','2 days later.','user'),m('c','2 days later.','assistant',{storyTime:null})];
  assert.equal(current(numbers).storyDay,3);
  const midnight=[m('a','Story time: 2026-11-25 23:30','user'),m('b','2 hours later.','user'),m('c','*I go to bed and fall asleep.*','user'),m('d','*The next morning I wake up.*','user')];
  assert.equal(current(midnight).storyDay,2,'Midnight and the following waking are one calendar day change');
});

test('uncertain gaps and flashbacks do not turn observed day boundaries into exact durations',()=>{
  const messages=[m('a','*I start repairing the clock.*'),m('b','*Some time later, it is evening.*'),m('c','*The next morning I wake up.*')];
  const timing=evidenceTimes([{id:'clock',sources:['a']}],timelineContext({messages}))[0];
  assert.equal(timing.narrativeDayChangesSinceEvidence,null);assert.equal(timing.dayCountUncertain,true);
  assert.equal(timing.minutesSinceEvidence,null);
});

test('v1 startup is rebuilt from all narrative text, including replies with null structured time',t=>{
  const directory=mkdtempSync(join(tmpdir(),'storychat-day-rebuild-')),path=join(directory,'story.sqlite');
  let store=new Store(path);t.after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});
  const character=store.createCharacter({name:'Lina',definition:'An adult observatory keeper.'}),persona=store.createPersona({name:'Ari',definition:'An adult instrument maker.'});
  const id=store.createStory({title:'Observatory repairs',characterId:character.id,personaId:persona.id}).id;
  const story=store.load(id);
  story.messages=[m('discussion','*Wir besprechen eine Reparatur am Teleskop.*','user'),m('onset','*Ich breite die Teile des Teleskops aus und beginne mit der Reparatur. Das dauert mehrere Tage.*','user')];
  for(let day=0;day<3;day++){
    story.messages.push(m('evening-'+day,'*Es wird Abend. Sie geht ins Bett und schläft ein.*','assistant',{storyTime:null}));
    story.messages.push(m('morning-'+day,'*Ich wache auf, hole die Werkzeuge und arbeite weiter.*','user'));
    story.messages.push(m('echo-'+day,'*Der Mechaniker erwacht ebenfalls und kommt zur Werkstatt.*','assistant',{storyTime:null}));
    for(let i=0;i<8;i++)story.messages.push(m(`filler-${day}-${i}`,'*Wir sortieren Schrauben und räumen die Werkbank auf.*',i%2?'user':'assistant'));
  }
  story.timeline={version:1,points:[]};story.memories=[{id:'protected',kind:'fact',key:'repair',text:'The original telescope belongs to the observatory.',sources:['onset'],revision:0,pinned:true,corrected:true}];
  store.db.prepare('UPDATE stories SET data=? WHERE id=?').run(JSON.stringify(story),id);
  store.close();store=new Store(path);
  const result=store.load(id);assert.equal(result.timeline.version,3);assert.equal(result.timeline.points.at(-1).storyDay,4);
  assert.deepEqual(result.messages,story.messages);assert.deepEqual(result.memories,story.memories);assert.equal(result.revision,story.revision);
  const attempt=store.beginTurn(id,{requestId:'time-question',text:'Wie viele Tage arbeite ich schon am Teleskop, seit ich die Teile ausgebreitet habe?'});
  const evidence=attempt.context.timeline.historicalEvidence.find(e=>e.sourceId==='onset');
  assert.ok(evidence,'The actual onset must be retrieved from outside recent context');
  assert.equal(evidence.endStoryDay,1);assert.equal(evidence.dayChangesSinceEvidence,3);assert.match(evidence.text,/beginne mit der Reparatur/);
  assert.ok(!attempt.context.messages.some(m=>m.id==='onset'));assert.ok(attempt.context.sourceIds.includes('onset'));
  store.finishTurn(id,attempt.generation.id,blank);
  const backup=exportData(store,{includeHistory:true});
  const forged=structuredClone(backup);forged.stories[0].generations.at(-1).context.timeline.historicalEvidence[0].text='Forged time evidence.';
  assert.throws(()=>validateTransfer(forged),{code:'invalid'});
  const target=new Store(':memory:');t.after(()=>target.close());importData(target,backup);
  assert.equal(target.getStory(id).timeline.points.at(-1).storyDay,4);
  const persisted=store.db.prepare('SELECT data FROM stories WHERE id=?').get(id).data;
  store.close();store=new Store(path);assert.equal(store.db.prepare('SELECT data FROM stories WHERE id=?').get(id).data,persisted);
});

test('failed and superseded text is ignored and rebuilding remains story-local',()=>{
  const messages=[m('a','*I begin restoring a chair.*'),m('b','*The next morning I wake up.*','user',{storyTime:null}),m('c','*The next morning I wake up.*','assistant',{superseded:true}),m('d','*The next morning I wake up.*','assistant',{kind:'thought'})];
  assert.equal(current(messages).storyDay,1);
  assert.equal(current([m('other','*It is evening.*')]).storyDay,1);
});

test('ordinary conjugations and word order work across paragraphs without scene markers',()=>{
  for(const waking of ['*Als ich am Morgen aufwache, rieche ich frischen Kaffee.*','*Ich bin aufgewacht und suche meine Brille.*','*Langsam werde ich wach und strecke mich.*','*Waking up, I hear the birds outside.*','*When we awaken, sunlight fills the workshop.*']){
    const messages=[m('a','*We start restoring an old map.*'),m('b','*Es wird Abend. Ich schlief ein.*','user'),m('c',waking,'user')];
    assert.equal(current(messages).storyDay,2,waking);
  }
  for(const planned of ['*Ich werde morgen früh aufwachen.*','*Ich wache morgen wieder auf.*','*Er denkt an den nächsten Morgen.*'])assert.equal(current([m('a','*Es wird Abend. Wir gehen schlafen.*'),m('b',planned)]).storyDay,1,planned);
});

test('inline multi-day skips use day precision and do not duplicate explicit durations',()=>{
  const clock=current([m('a','*I start restoring a globe.*'),m('b','*Zwei Tage später arbeite ich am Globus weiter. Die Farbe trocknet langsam.*','user'),m('c','*The globe gleams. Three days later, the next morning, she returns to the workshop.*')]);
  assert.equal(clock.storyDay,6);assert.equal(clock.time,null);
  assert.equal(current([m('a','We begin.'),m('b','Two weeks later.','user')]).storyDay,15);
});

test('a gap before an activity does not make later well-supported day counts unusable',()=>{
  const messages=[m('a','We enter the workshop.'),m('b','*Some time later, she returns.*'),m('start','*I start repairing the globe.*','user'),m('bed','*It is evening. We fall asleep.*'),m('wake','*The next morning, I wake up.*','user')];
  const timing=evidenceTimes([{id:'work',sources:['start']}],timelineContext({messages}))[0];
  assert.equal(timing.narrativeDayChangesSinceEvidence,1);assert.equal(timing.dayCountUncertain,false);
});

test('day counts survive source-turn replacement without retaining a discarded night',t=>{
  const store=new Store(':memory:');t.after(()=>store.close());
  const c=store.createCharacter({name:'Lina',definition:'An adult painter.'}),p=store.createPersona({name:'Ari',definition:'An adult restorer.'});
  const id=store.createStory({title:'Mural',characterId:c.id,personaId:p.id}).id;
  const a=store.beginTurn(id,{requestId:'start',text:'*I start restoring the mural. It is evening. I go to sleep.*'});store.finishTurn(id,a.generation.id,blank);
  const b=store.beginTurn(id,{requestId:'wake',text:'*The next morning, I wake up.*'});store.finishTurn(id,b.generation.id,blank);
  assert.equal(store.getStory(id).timeline.points.at(-1).storyDay,2);
  const replacement=store.beginReplacement(id,{requestId:'replace',generationId:b.generation.id,revision:store.getStory(id).revision,text:'*I stay awake through the evening.*'});store.finishTurn(id,replacement.generation.id,blank);
  assert.equal(store.getStory(id).timeline.points.at(-1).storyDay,1);
});

test('temporal recall locates late-in-message activity evidence and excludes suppressed or failed sources',()=>{
  const messages=[m('a','A quiet room. '.repeat(250)+'I begin restoring the astrolabe, laying out its pieces.'),m('b','*It is evening. We go to sleep.*'),m('c','*The next morning, I wake up.*','user'),m('failed','*I start restoring an astrolabe.*','user',{storyTime:null})];
  // Test through the same selection used by normal requests, without model calls.
  const story={messages,generations:[],suppression:[],memories:[],threads:[],relationship:[],thoughts:[]};
  return import('../narrative-time.mjs').then(({recallTimeEvidence})=>{
    const evidence=recallTimeEvidence(story,timelineContext(story),'How long have I been restoring the astrolabe?');
    assert.match(evidence.find(e=>e.sourceId==='a').text,/I begin restoring the astrolabe/);
    assert.ok(!evidence.some(e=>e.sourceId==='failed'));
    story.suppression.push({text:'I begin restoring the astrolabe',key:'old',reason:'deletion'});
    assert.ok(!recallTimeEvidence(story,timelineContext(story),'How long have I been restoring the astrolabe?').some(e=>e.sourceId==='a'));
  });
});
