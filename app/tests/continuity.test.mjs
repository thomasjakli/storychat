import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Store } from '../store.mjs';
import { createApplication } from '../server.mjs';
import { createProvider } from '../provider.mjs';

const blank = reply => ({ reply: reply || 'SYNTHETIC QA: The scene continues.', memories: [], threads: [], relationship: [], thoughts: [], scene: null });
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'storychat-continuity-'));
  const path = join(directory, 'qa.sqlite');
  const store = new Store(path);
  t.after(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });
  const character = store.createCharacter({ name: 'Nera', definition: 'An adult lighthouse keeper. Patient, pragmatic, and careful about promises.', opening: 'The lighthouse door stands open.' });
  const persona = store.createPersona({ name: 'Sol', definition: 'An adult visitor researching coastal routes.' });
  const story = store.createStory({ characterId: character.id, personaId: persona.id, title: 'Original synthetic lighthouse story' });
  return { store, path, story, character, persona };
}
function scriptedTurn(f, text, script = () => blank()) {
  const attempt = f.store.beginTurn(f.story.id, { requestId: crypto.randomUUID(), text });
  const source = attempt.generation.userMessageId;
  return f.store.finishTurn(f.story.id, attempt.generation.id, script(source, attempt.context));
}
const entry = (key, text, source) => ({ key, text, sources: [source] });

test('QA: durable source-linked continuity survives a separate process after transcript truncation', async t => {
  const f = fixture(t);
  const initial = scriptedTurn(f, 'I live in Harbor Lane. I promise to return your compass at dawn; thank you for trusting me.', source => ({
    ...blank('SYNTHETIC QA: Nera accepts the promise.'),
    memories: [{ kind: 'fact', ...entry('home', 'Sol lives in Harbor Lane.', source) }],
    threads: [{ ...entry('compass', 'Sol promised to return the compass at dawn; Nera accepted.', source), status: 'pending' }],
    relationship: [entry('trust', 'Nera trusts Sol more after accepting the compass promise.', source)],
    thoughts: [entry('hope', 'Fictional thought: I hope Sol keeps the promise.', source)],
    scene: { text: 'Inside the lighthouse.', fictionalTime: 'First evening', sources: [source] },
  }));
  const evidence = initial.memories[0].sources[0];
  for (let index = 0; index < 7; index++) scriptedTurn(f, `We examine original coastal chart ${index}.`);
  const before = f.store.getStory(f.story.id);
  f.store.setControls(f.story.id, { tone: 'Reserved', detail: 'rich', length: 'short' });
  const child = spawnSync(process.execPath, ['--input-type=module', '-e',
    `import { Store } from ${JSON.stringify(new URL('../store.mjs', import.meta.url).href)};
     const RealDate=Date; globalThis.Date=class extends RealDate { constructor(...args){super(...(args.length?args:[RealDate.now()+7*86400000]));} static now(){return RealDate.now()+7*86400000;} };
     const store = new Store(process.argv[1]);
     const state = store.getStory(process.argv[2]);
     const context = store.beginTurn(state.id, {requestId:'qa-child-resume',text:'What do I still owe you, and where do I live?'}).context;
     console.log(JSON.stringify({state,context})); store.close();`, f.path, f.story.id], { encoding: 'utf8', windowsHide: true });
  assert.equal(child.status, 0, child.stderr);
  const resumed = JSON.parse(child.stdout);
  assert.equal(resumed.context.messages.length, 12);
  assert.ok(!resumed.context.messages.some(message => message.id === evidence));
  assert.ok(resumed.context.sourceIds.includes(evidence));
  assert.match(resumed.context.summary, /Harbor Lane/);
  assert.equal(resumed.context.threads[0].status, 'pending');
  assert.equal(resumed.state.scene.fictionalTime, 'First evening');
  assert.deepEqual(resumed.state.scene, before.scene);
  assert.deepEqual(resumed.state.relationship, before.relationship);
  assert.deepEqual(resumed.context.controls, { tone: 'Reserved', detail: 'rich', length: 'short' });
  assert.equal(resumed.state.messages.length, before.messages.length);
  assert.ok(Date.parse(resumed.context.messages.at(-1).createdAt) > Date.now() + 6 * 86400000);
  const fake = await createProvider({ mode: 'fake' });
  assert.match((await fake.generate(resumed.context)).reply, /Harbor Lane/);
  await fake.close();
});

test('QA: correcting/deleting a fact removes stale derived copies and blocks later summary resurrection', t => {
  const f = fixture(t);
  let story = scriptedTurn(f, 'My home is Bay Street. I carry a red ribbon.', source => ({
    ...blank(), memories: [
      { kind: 'fact', ...entry('home', 'Sol lives on Bay Street.', source) },
      { kind: 'fact', ...entry('ribbon', 'Sol carries a red ribbon.', source) },
    ],
    threads: [{ ...entry('visit', 'Visit later: Sol lives on Bay Street.', source), status: 'pending' }],
    relationship: [entry('familiarity', 'Nera remembers that Sol lives on Bay Street.', source)],
    thoughts: [entry('address', 'Sol lives on Bay Street. I should remember this.', source)],
    scene: { text: 'Sol lives on Bay Street. They are outside that home.', fictionalTime: 'Evening', sources: [source] },
  }));
  story = f.store.editMemory(f.story.id, story.memories[0].id, { text: 'Sol lives on Harbor Lane.', pinned: true });
  assert.doesNotMatch(JSON.stringify({ summary: story.summary, relationship: story.relationship, thoughts: story.thoughts, threads: story.threads, scene: story.scene }), /Bay Street/);
  f.store.deleteMemory(f.story.id, story.memories.find(memory => memory.key === 'ribbon').id);
  story = scriptedTurn(f, 'Continue the scene using the corrected details.', source => ({
    ...blank(), memories: [
      { kind: 'fact', ...entry('home', 'Sol lives on Bay Street.', source) },
      { kind: 'fact', ...entry('ribbon', 'Sol carries a red ribbon.', source) },
    ],
    relationship: [entry('stale-address', 'Sol lives on Bay Street.', source)],
    thoughts: [entry('stale-ribbon', 'Sol carries a red ribbon.', source)],
  }));
  assert.equal(story.memories.length, 1);
  assert.equal(story.memories[0].pinned, true);
  assert.equal(story.memories[0].corrected, true);
  assert.match(story.summary, /Harbor Lane/);
  assert.doesNotMatch(JSON.stringify({ summary: story.summary, relationship: story.relationship, thoughts: story.thoughts }), /Bay Street|red ribbon/);
});

test('QA: plans complete on story evidence, conflicting facts reconcile, and another story stays ignorant', t => {
  const f = fixture(t);
  let story = scriptedTurn(f, 'I live east. I promise to bring the compass.', source => ({ ...blank(),
    memories: [{ kind: 'fact', ...entry('home', 'Sol lives east.', source) }],
    threads: [{ ...entry('compass', 'Bring the compass.', source), status: 'pending' }],
  }));
  story = scriptedTurn(f, 'I live west. Here is the compass I promised.', source => ({ ...blank(),
    memories: [{ kind: 'fact', ...entry('home', 'Sol lives west.', source) }, { kind: 'event', ...entry('delivered', 'Sol delivered the compass.', source) }],
    threads: [{ ...entry('compass', 'Sol delivered the promised compass.', source), status: 'completed' }],
  }));
  assert.equal(story.memories.filter(memory => memory.conflict).length, 2);
  story = f.store.editMemory(f.story.id, story.memories.find(memory => memory.key === 'home').id, { text: 'Sol lives west.' });
  assert.equal(story.memories.filter(memory => memory.key === 'home').length, 1);
  assert.equal(story.threads[0].status, 'completed');
  const second = f.store.createStory({ characterId: f.character.id, personaId: f.persona.id, title: 'Independent shore' });
  const attempt = f.store.beginTurn(second.id, { requestId: 'independent', text: 'Have we met before?' });
  assert.equal(attempt.context.summary, '');
  for (const key of ['memories', 'threads', 'thoughts', 'relationship']) assert.deepEqual(attempt.context[key], []);
  const stolen = story.memories[0].sources[0];
  assert.throws(() => f.store.finishTurn(second.id, attempt.generation.id, { ...blank(), memories: [{ kind: 'fact', ...entry('stolen', 'Private other-story fact.', stolen) }] }), { code: 'invalid' });
  assert.equal(f.store.getStory(second.id).memories.length, 0);
});

test('QA: rejected output is atomic and pending attempts cannot survive a fresh process startup', t => {
  const f = fixture(t);
  const attempt = f.store.beginTurn(f.story.id, { requestId: 'invalid-output', text: 'An explicitly pending turn.' });
  assert.throws(() => f.store.finishTurn(f.story.id, attempt.generation.id, { ...blank(),
    memories: [{ kind: 'fact', ...entry('valid-first', 'A valid-looking first operation.', attempt.generation.userMessageId) }],
    thoughts: [entry('invalid-last', 'A rejected final operation.', 'nonexistent-source')],
  }), { code: 'invalid' });
  assert.equal(f.store.getStory(f.story.id).memories.length, 0);
  const child = spawnSync(process.execPath, ['--input-type=module', '-e',
    `import { Store } from ${JSON.stringify(new URL('../store.mjs', import.meta.url).href)}; const store=new Store(process.argv[1]); console.log(JSON.stringify(store.getStory(process.argv[2]))); store.close();`, f.path, f.story.id], { encoding: 'utf8', windowsHide: true });
  assert.equal(child.status, 0, child.stderr);
  const restarted = JSON.parse(child.stdout);
  assert.equal(restarted.generations.at(-1).status, 'interrupted');
  assert.equal(restarted.revision, 0);
  assert.equal(restarted.messages.filter(message => message.generationId).length, 0);
  assert.throws(() => f.store.finishTurn(f.story.id, attempt.generation.id, blank()), { code: 'conflict' });
});

test('QA: unauthorized callers cannot inspect or mutate known story IDs or trigger inference', async t => {
  const store = new Store(':memory:');
  let calls = 0;
  const provider = { name: 'fake', model: 'scripted-qa', generate: async () => { calls++; return blank(); } };
  const character = store.createCharacter({ name: 'Nera', definition: 'Synthetic adult keeper.' });
  const persona = store.createPersona({ name: 'Sol', definition: 'Synthetic adult visitor.' });
  const story = store.createStory({ characterId: character.id, personaId: persona.id, title: 'Private test' });
  const app = createApplication({ store, provider, password: 'synthetic-qa-password' });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  t.after(() => app.close());
  const origin = `http://127.0.0.1:${app.server.address().port}`, path = `/api/stories/${story.id}`;
  for (const [route, method, body] of [[path, 'GET'], [path, 'DELETE'], [path + '/controls', 'PATCH', { tone: 'Warm', detail: 'rich', length: 'long' }], [path + '/turns', 'POST', { requestId: 'intrusion', text: 'Generate.' }]]) {
    const response = await fetch(origin + route, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    assert.equal(response.status, 401);
    assert.ok(!JSON.stringify(await response.json()).includes('Synthetic adult keeper'));
  }
  assert.equal(calls, 0); assert.equal(store.getStory(story.id).generations.length, 0);
});
