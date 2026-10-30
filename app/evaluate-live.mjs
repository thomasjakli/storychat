// Explicit, bounded owner-triggered evaluation. Never part of the offline test runner.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Store } from './store.mjs';
import { createProvider } from './provider.mjs';

if (process.env.STORYCHAT_LIVE_EVAL !== 'yes') throw new Error('Explicitly set STORYCHAT_LIVE_EVAL=yes to authorize four ChatGPT subscription requests.');
const provider=await createProvider({mode:'chatgpt'});
const path=resolve('data/live-evaluation',randomUUID()+'.sqlite');
let store=new Store(path), calls=0;
const results=[];
try {
  const character=store.createCharacter({name:'Mira',definition:'Mira is an adult cartographer, age 30, patient and observant. She respects boundaries, keeps careful promises and speaks concise original dialogue.',opening:'At the harbor, Mira places a lantern on the table.'});
  const persona=store.createPersona({name:'Ivo',definition:'Ivo is an adult traveler, age 32. This is a wholly synthetic fictional story.'});
  const story=store.createStory({characterId:character.id,personaId:persona.id,title:'Synthetic continuity evaluation'});
  store.setControls(story.id,{tone:'Warm',detail:'minimal',length:'short'});
  async function turn(text) {
    const {generation,context}=store.beginTurn(story.id,{requestId:randomUUID(),text});
    assert.ok(calls < 4); calls++;
    try { const output=await provider.generate(context); return store.finishTurn(story.id,generation.id,output); }
    catch(error) {store.failTurn(story.id,generation.id,error.code); throw error;}
  }
  let current=await turn('It is fictional dusk before the harbor festival. My favorite tea is silvermint. My home is Copper Bay. I promise to bring you the amber compass tomorrow; please explicitly accept that promise. You stayed beside me through the storm, which made me trust you. Acknowledge these established details and the meaningful event, and include a brief authored fictional thought. Nothing has been delivered yet.');
  const source=current.messages.find(m=>m.role === 'user').id;
  const tea=current.memories.find(m=>/silvermint/i.test(m.text));
  const home=current.memories.find(m=>/Copper Bay/i.test(m.text));
  assert.ok(tea && home,'Initial facts were not extracted.'); assert.ok(current.threads.some(t=>t.status === 'pending' && /compass/i.test(t.text)),'Accepted promise missing.');
  assert.ok(current.memories.some(m=>m.kind === 'event'),'Meaningful event missing.'); assert.ok(current.relationship.length && current.thoughts.length,'Relationship/thought evidence missing.');
  assert.ok(current.scene?.fictionalTime,'Fictional scene time missing.');
  results.push('Initial live extraction: facts, accepted promise, event, relationship, thought and scene, with validated sources.');
  // Deterministic filler establishes eviction without spending seven additional model requests.
  for(let index=0;index<7;index++) {
    const {generation}=store.beginTurn(story.id,{requestId:randomUUID(),text:'We quietly observe the harbor lanterns without changing the scene.'});
    store.finishTurn(story.id,generation.id,{reply:'The lanterns glow steadily.',memories:[],threads:[],relationship:[],thoughts:[],scene:null});
  }
  store.close(); store=new Store(path);
  const before=store.getStory(story.id);
  assert.ok(!before.messages.slice(-6).some(m=>m.id === source));
  current=await turn('Before we leave, remind me of my preferred tea, my home and the exact thing I promised you. We are still at the same fictional dusk; no delivery or passage of fictional time has happened.');
  assert.match(current.messages.at(-1).text,/silvermint/i); assert.match(current.messages.at(-1).text,/Copper Bay/i); assert.match(current.messages.at(-1).text,/compass/i);
  assert.ok(current.threads.filter(t=>/compass/i.test(t.text)).every(t=>t.status === 'pending'));
  assert.match(current.scene.fictionalTime,/dusk/i,'Fictional time advanced without a story event.');
  results.push('Live recall after SQLite reopen and seven deterministic filler turns: original source absent from recent context; promise still pending and fictional time unchanged.');
  store.editMemory(story.id,tea.id,{text:'The player’s favorite tea is cloudleaf.',pinned:true});
  store.deleteMemory(story.id,home.id);
  current=await turn('A quoted obsolete note mentions silvermint and Copper Bay. That note is superseded, not new story evidence. Respect my owner-corrected preference and removed home memory. What tea should we share, and what promise remains unresolved? Do not advance the scene or complete the delivery.');
  assert.match(current.messages.at(-1).text,/cloudleaf/i);
  assert.ok(current.memories.some(m=>m.id === tea.id && m.corrected && m.pinned && /cloudleaf/.test(m.text)));
  const active=JSON.stringify({memories:current.memories,summary:current.summary,threads:current.threads,relationship:current.relationship,thoughts:current.thoughts,scene:current.scene});
  assert.ok(!/silvermint|Copper Bay/i.test(active),'Suppressed content reappeared in active state.');
  results.push('Live correction/deletion check: pinned cloudleaf preference used; obsolete preference and removed home absent from active state and summary.');
  current=await turn('Now the fiction explicitly advances to the next morning at the harbor. I place the amber compass in your hand, completing my accepted promise. Please acknowledge the actual delivery, mark that promise completed, and record this established event.');
  assert.ok(current.threads.some(t=>t.status === 'completed' && /compass/i.test(t.text)),'Promise not completed.');
  assert.ok(current.memories.some(m=>m.kind === 'event' && /compass/i.test(m.text)),'Delivery event missing.');
  assert.match(current.scene.fictionalTime,/morning/i);
  results.push('Live explicit next-morning delivery becomes a completed promise and sourced event.');
  console.log(JSON.stringify({passed:true,calls,model:provider.model,results},null,2));
} catch(error) {
  // No raw provider bodies, tokens, story output or account identifiers in logs.
  console.log(JSON.stringify({passed:false,calls,code:error.code || 'evaluation_assertion',check:'Live evaluation failed; inspect the private synthetic evaluation database locally.',results},null,2));
  process.exitCode=1;
} finally {store.close();await provider.close();}
