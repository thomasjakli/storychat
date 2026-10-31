import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store, validateOutput } from '../store.mjs';

const empty = (reply = 'The lantern glows.') => ({ reply, memories: [], threads: [], relationship: [], thoughts: [], scene: null });
function fixture(t, disk = false) {
  const directory = mkdtempSync(join(tmpdir(), 'storychat-memory-'));
  const path = disk ? join(directory, 'stories.sqlite') : ':memory:';
  const store = new Store(path);
  const character = store.createCharacter({ name: 'Mara', definition: 'An adult cartographer who values keeping promises.', opening: 'Welcome to the observatory.' });
  const persona = store.createPersona({ name: 'Rowan', definition: 'An adult visitor carrying an atlas.' });
  const story = store.createStory({ characterId: character.id, personaId: persona.id, title: 'Observatory' });
  const f = { store, path, story, character, persona };
  t.after(() => { f.store.close(); rmSync(directory, { recursive: true, force: true }); });
  return f;
}
function turn(f, userText, make = () => empty()) {
  const attempt = f.store.beginTurn(f.story.id, { requestId: crypto.randomUUID(), text: userText });
  const result = make(attempt.generation.userMessageId);
  return { attempt, story: f.store.finishTurn(f.story.id, attempt.generation.id, result) };
}
const memory = (source, key = 'tea', text = 'Rowan prefers mint tea.') => ({ kind: 'fact', key, text, sources: [source] });

test('persistent snapshots, evidence, relationships and fictional time survive reopening', t => {
  const f = fixture(t, true);
  const { attempt } = turn(f, 'I prefer mint tea. I promise to bring an atlas tomorrow. Your help means a lot.', source => ({
    ...empty('Mara smiles and accepts the promise.'), memories: [memory(source)],
    threads: [{ key: 'atlas', text: 'Rowan promised an atlas tomorrow; Mara accepted.', status: 'pending', sources: [source] }],
    relationship: [{ key: 'trust', text: 'Mara feels more trust after Rowan expressed gratitude.', sources: [source] }],
    thoughts: [{ key: 'hope', text: 'Fictional inner thought: I hope Rowan returns with the atlas.', sources: [source] }],
    scene: { text: 'At the observatory.', fictionalTime: 'First evening', sources: [source] },
  }));
  f.store.close(); f.store = new Store(f.path);
  const resumed = f.store.getStory(f.story.id);
  assert.equal(resumed.character.definition, f.character.definition);
  assert.equal(resumed.persona.name, 'Rowan');
  assert.equal(resumed.memories[0].sources[0], attempt.generation.userMessageId);
  assert.equal(resumed.relationship[0].sources[0], attempt.generation.userMessageId);
  assert.equal(resumed.scene.fictionalTime, 'First evening');
  assert.equal(resumed.threads[0].status, 'pending');
  assert.match(resumed.thoughts[0].text, /Fictional inner thought/);
});

test('recall uses durable state after evidence leaves bounded recent window', t => {
  const f = fixture(t);
  const original = turn(f, 'I prefer mint tea.', source => ({ ...empty(), memories: [memory(source)] })).attempt.generation.userMessageId;
  for (let n = 0; n < 6; n++) turn(f, `We discuss constellation number ${n}.`);
  const { context } = f.store.beginTurn(f.story.id, { requestId: 'recall', text: 'What tea should we prepare?' });
  assert.equal(context.messages.length, 12);
  assert.ok(!context.messages.some(message => message.id === original));
  assert.equal(context.memories.find(m => m.key === 'tea').text, 'Rowan prefers mint tea.');
  assert.ok(context.sourceIds.includes(original));
  assert.equal(f.store.getStory(f.story.id).messages.length, 16);
});

test('correction, pins, deletion and suppression survive restart and later extraction/summary', t => {
  const f = fixture(t, true);
  turn(f, 'I like mint tea and have a silver locket.', source => ({ ...empty(), memories: [memory(source), memory(source, 'locket', 'Rowan has a silver locket.')] }));
  const memories = f.store.getStory(f.story.id).memories;
  f.store.editMemory(f.story.id, memories[0].id, { text: 'Rowan prefers black tea.', pinned: true });
  f.store.deleteMemory(f.story.id, memories[1].id);
  f.store.close(); f.store = new Store(f.path);
  const { story } = turn(f, 'Recall our details.', source => ({ ...empty(), memories: [memory(source), memory(source, 'locket', 'Rowan wears the silver locket.'), memory(source, 'different-key', 'Rowan has a silver locket.')] }));
  assert.equal(story.memories.length, 1);
  assert.equal(story.memories[0].text, 'Rowan prefers black tea.');
  assert.equal(story.memories[0].corrected, true);
  assert.equal(story.memories[0].pinned, true);
  assert.match(story.summary, /black tea/); assert.doesNotMatch(story.summary, /mint|locket/);
  const context = f.store.beginTurn(f.story.id, { requestId: 'check-suppression', text: 'What remains?' }).context;
  assert.equal(context.memories[0].pinned, true);
  assert.ok(context.suppression.some(s => s.key === 'locket'));
});

test('conflicting facts remain until owner reconciliation; thread completion never reopens implicitly', t => {
  const f = fixture(t);
  turn(f, 'My home is east; I will bring an atlas.', source => ({ ...empty(), memories: [memory(source, 'home', 'Rowan lives east of the river.')], threads: [{ key: 'atlas', text: 'Bring an atlas.', status: 'pending', sources: [source] }] }));
  let state = turn(f, 'Actually my home is west. Here is the atlas.', source => ({ ...empty(), memories: [memory(source, 'home', 'Rowan lives west of the river.')], threads: [{ key: 'atlas', text: 'Rowan delivered the atlas.', status: 'completed', sources: [source] }] })).story;
  assert.equal(state.memories.length, 2); assert.ok(state.memories.every(m => m.conflict));
  state = f.store.editMemory(f.story.id, state.memories[0].id, { text: 'Rowan lives west of the river.' });
  assert.equal(state.memories.length, 1); assert.equal(state.memories[0].conflict, false);
  state = turn(f, 'Continue.', source => ({ ...empty(), threads: [{ key: 'atlas', text: 'Bring an atlas tomorrow.', status: 'pending', sources: [source] }] })).story;
  assert.equal(state.threads[0].status, 'completed');
});

test('separate stories reuse snapshots without state leakage and can be completely deleted', t => {
  const f = fixture(t);
  turn(f, 'A secret in this story.', source => ({ ...empty(), memories: [memory(source)] }));
  const second = f.store.createStory({ characterId: f.character.id, personaId: f.persona.id, title: 'Another beginning' });
  const attempt = f.store.beginTurn(second.id, { requestId: 'second', text: 'What do you know?' });
  assert.deepEqual(attempt.context.memories, []);
  assert.equal(attempt.context.summary, '');
  assert.equal(attempt.context.messages.length, 2);
  const otherSource = f.store.getStory(f.story.id).memories[0].sources[0];
  assert.throws(() => f.store.finishTurn(second.id, attempt.generation.id, { ...empty(), memories: [memory(otherSource)] }), { code: 'invalid' });
  f.store.deleteStory(f.story.id);
  assert.throws(() => f.store.getStory(f.story.id), { code: 'not_found' });
  assert.equal(f.store.library().stories.length, 1);
});

test('atomic validation, explicit failed retries, idempotency and pending-turn serialization', t => {
  const f = fixture(t);
  const a = f.store.beginTurn(f.story.id, { requestId: 'one', text: 'A new fact.' });
  assert.equal(f.store.beginTurn(f.story.id, { requestId: 'one', text: 'A new fact.' }).generation.id, a.generation.id);
  assert.throws(() => f.store.beginTurn(f.story.id, { requestId: 'two', text: 'Concurrent turn.' }), { code: 'conflict' });
  assert.throws(() => f.store.beginTurn(f.story.id, { requestId: 'one', text: 'Changed text.' }), { code: 'invalid' });
  const invalid = { ...empty(), memories: [memory(a.generation.userMessageId)], relationship: [{ key: 'trust', text: 'Ungrounded.', sources: ['foreign-source'] }] };
  assert.throws(() => f.store.finishTurn(f.story.id, a.generation.id, invalid), { code: 'invalid' });
  let state = f.store.getStory(f.story.id); assert.equal(state.memories.length, 0); assert.equal(state.messages.length, 2); assert.equal(state.revision, 0);
  f.store.failTurn(f.story.id, a.generation.id, 'interrupted');
  assert.equal(f.store.getStory(f.story.id).generations[0].status, 'failed');
  const b = f.store.beginTurn(f.story.id, { requestId: 'retry-explicit', text: 'A new fact.' });
  const out = { ...empty(), memories: [memory(b.generation.userMessageId)] };
  state = f.store.finishTurn(f.story.id, b.generation.id, out);
  assert.equal(state.memories.length, 1);
  assert.equal(f.store.finishTurn(f.story.id, b.generation.id, out).messages.length, state.messages.length);
});

test('startup interrupts pending attempts; stale completion cannot overwrite owner correction', t => {
  const f = fixture(t, true);
  turn(f, 'Mint tea.', source => ({ ...empty(), memories: [memory(source)] }));
  const pending = f.store.beginTurn(f.story.id, { requestId: 'pending', text: 'Continue.' });
  const m = f.store.getStory(f.story.id).memories[0];
  f.store.editMemory(f.story.id, m.id, { text: 'Black tea.' });
  assert.throws(() => f.store.finishTurn(f.story.id, pending.generation.id, empty()), { code: 'conflict' });
  f.store.close(); f.store = new Store(f.path);
  const state = f.store.getStory(f.story.id);
  assert.equal(state.generations.at(-1).status, 'interrupted');
  assert.equal(state.memories[0].text, 'Black tea.');
  assert.throws(() => f.store.finishTurn(f.story.id, pending.generation.id, empty()), { code: 'conflict' });
});

test('writing controls persist independently without advancing time or altering state', t => {
  const f = fixture(t, true);
  turn(f, 'Stay at dawn.', source => ({ ...empty(), memories: [memory(source)], scene: { text: 'By the river.', fictionalTime: 'Dawn, first day', sources: [source] } }));
  const before = f.store.getStory(f.story.id);
  f.store.setControls(f.story.id, { tone: 'Serious', detail: 'rich', length: 'short' });
  f.store.close(); f.store = new Store(f.path);
  const after = f.store.getStory(f.story.id);
  assert.deepEqual(after.controls, { tone: 'Serious', detail: 'rich', length: 'short' });
  assert.deepEqual(after.memories, before.memories); assert.deepEqual(after.scene, before.scene); assert.equal(after.revision, before.revision);
  assert.throws(() => f.store.setControls(f.story.id, { tone: 'Warm', detail: 'reasoning', length: 'short' }), { code: 'invalid' });
});

test('strict output rejects unknown fields, unknown sources, unbounded text and ambiguous plan states', () => {
  for (const output of [{ ...empty(), command: 'execute' }, { ...empty(), reply: 'x'.repeat(12001) }, { ...empty(), memories: [{ ...memory('known'), kind: 'intention' }] }, { ...empty(), threads: [{ key: 'atlas', text: 'Maybe.', status: 'maybe', sources: ['known'] }] }, { ...empty(), thoughts: [{ key: 'thought', text: 'Private reasoning.', sources: [] }] }]) assert.throws(() => validateOutput(output, ['known']), { code: 'invalid' });
  assert.deepEqual(validateOutput(empty(), []), empty());
});

test('correction prunes old fact text copied into every derived state category', t => {
  const f = fixture(t);
  const former = 'Rowan lives beside the old mill.';
  const entry = source => ({ key: 'other', text: `Remember: ${former}`, sources: [source] });
  const state = turn(f, former, source => ({ ...empty(), memories: [memory(source, 'home', former)],
    threads: [{ ...entry(source), status: 'pending' }], relationship: [entry(source)], thoughts: [entry(source)],
    scene: { text: former, fictionalTime: 'Dawn', sources: [source] },
  })).story;
  const corrected = f.store.editMemory(f.story.id, state.memories[0].id, { text: 'Rowan lives beside the harbor.' });
  assert.doesNotMatch(JSON.stringify({ summary: corrected.summary, threads: corrected.threads, relationship: corrected.relationship, thoughts: corrected.thoughts, scene: corrected.scene }), /old mill/);
  assert.equal(corrected.scene, null);
  assert.match(corrected.summary, /harbor/);
});
