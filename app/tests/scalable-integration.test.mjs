import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../store.mjs';
import { exportData, importData } from '../transfer.mjs';
import { createApplication } from '../server.mjs';

const blank = () => ({ reply: 'SYNTHETIC QA: The harbor lamps are lit.', memories: [], threads: [], relationship: [], thoughts: [], scene: null });
const proposal = (key, text, source) => ({ key, text, sources: [source] });

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'storychat-scalable-qa-'));
  const path = join(directory, 'stories.sqlite');
  const f = { store: new Store(path), path };
  t.after(async () => { if (f.app) await f.app.close(); else f.store.close(); rmSync(directory, { recursive: true, force: true }); });
  const character = f.store.createCharacter({ name: 'Leda', definition: 'An adult harbor archivist.', opening: 'The harbor archive opens at dusk.' });
  const persona = f.store.createPersona({ name: 'Ari', definition: 'An adult visitor studying charts.' });
  f.story = f.store.createStory({ characterId: character.id, personaId: persona.id, title: 'Original synthetic harbor archive' });
  f.other = f.store.createStory({ characterId: character.id, personaId: persona.id, title: 'Independent synthetic harbor' });
  const story = f.store.load(f.story.id), source = story.messages[0].id;
  const record = (prefix, index) => ({ id: `${prefix}-${index}`, ...proposal(`${prefix}.${index}`, `Original synthetic ${prefix} record ${index}.`, source), revision: 0 });
  story.memories = Array.from({ length: 3000 }, (_, i) => ({ ...record('memory', i), kind: 'fact', pinned: false, corrected: false }));
  story.threads = Array.from({ length: 250 }, (_, i) => ({ ...record('thread', i), status: i % 3 ? 'completed' : 'pending' }));
  story.relationship = Array.from({ length: 120 }, (_, i) => record('relationship', i));
  story.thoughts = Array.from({ length: 120 }, (_, i) => record('thought', i));
  f.store.save(story);
  return f;
}

test('independent QA: large-state replacement preserves owner corrections, deletion and isolation through restart and history restore', t => {
  const f = fixture(t);
  const attempt = f.store.beginTurn(f.story.id, { requestId: 'large-original', text: 'We place the copper astrolabe on the desk.' });
  const source = attempt.generation.userMessageId;
  f.store.finishTurn(f.story.id, attempt.generation.id, {
    ...blank(),
    memories: [{ kind: 'event', ...proposal('astrolabe', 'The copper astrolabe rests on the desk.', source) }],
    threads: [{ status: 'pending', ...proposal('astrolabe.study', 'Study the copper astrolabe together.', source) }],
    relationship: [proposal('astrolabe.trust', 'Leda trusts Ari with the copper astrolabe.', source)],
    thoughts: [proposal('astrolabe.interest', 'Fictional thought: I want to study the copper astrolabe.', source)],
  });
  f.store.editMemory(f.story.id, 'memory-0', { text: 'Ari keeps the corrected archive key in a blue pouch.', pinned: true });
  f.store.deleteMemory(f.story.id, 'memory-1');
  const revision = f.store.getStory(f.story.id).revision;
  const data = { requestId: 'large-replacement', generationId: attempt.generation.id, revision, text: 'We inspect the empty desk instead.' };
  const replacement = f.store.beginReplacement(f.story.id, data);
  assert.ok(replacement.context.memories.some(m => m.corrected && m.pinned && m.text.includes('blue pouch')));
  assert.ok(!replacement.context.memories.some(m => m.key === 'astrolabe'));
  assert.ok(!replacement.context.memories.some(m => m.id === 'memory-1'));
  const malformed = { ...blank(), memories: [{ kind: 'fact', ...proposal('foreign', 'This has no permitted evidence.', 'foreign-source') }] };
  assert.throws(() => f.store.finishTurn(f.story.id, replacement.generation.id, malformed));
  assert.equal(f.store.getStory(f.story.id).generations.at(-1).status, 'pending');
  const final = f.store.finishTurn(f.story.id, replacement.generation.id, blank());
  assert.equal(final.memories.length, 2999);
  assert.ok(!final.memories.some(m => m.key === 'astrolabe' || m.id === 'memory-1'));
  assert.ok(!final.threads.some(m => m.key === 'astrolabe.study'));
  assert.ok(!final.relationship.some(m => m.key === 'astrolabe.trust'));
  assert.ok(!final.thoughts.some(m => m.key === 'astrolabe.interest'));
  assert.equal(final.messages.filter(m => !m.superseded && m.role === 'assistant' && !m.kind).length, 1);
  assert.equal(f.store.beginReplacement(f.story.id, data).generation.id, replacement.generation.id);
  assert.deepEqual(f.store.getStory(f.other.id).memories, []);
  f.store.close(); f.store = new Store(f.path);
  assert.deepEqual(f.store.getStory(f.story.id), final);
  const restored = new Store(':memory:'); t.after(() => restored.close());
  importData(restored, exportData(f.store, { includeHistory: true }));
  const retained = restored.getStory(f.story.id);
  assert.deepEqual(retained, final);
  const resumed = restored.beginReplacement(f.story.id, { requestId: 'restored-replacement', generationId: replacement.generation.id, revision: retained.revision });
  restored.finishTurn(f.story.id, resumed.generation.id, blank());
  assert.equal(restored.getStory(f.story.id).memories.length, 2999);
  assert.equal(restored.getStory(f.story.id).memories.find(m => m.id === 'memory-0').corrected, true);
});

test('independent QA: completed large-state request replay stays idempotent after subsequent turns', t => {
  const f = fixture(t);
  const first = { requestId: 'ledger-first', text: 'We compare chart number one.' };
  const attempt = f.store.beginTurn(f.story.id, first);
  f.store.finishTurn(f.story.id, attempt.generation.id, blank());
  for (let i = 0; i < 5; i++) {
    const turn = f.store.beginTurn(f.story.id, { requestId: `ledger-${i}`, text: `We compare original chart ${i + 2}.` });
    f.store.finishTurn(f.story.id, turn.generation.id, blank());
  }
  const before = f.store.getStory(f.story.id);
  assert.equal(f.store.beginTurn(f.story.id, first).generation.id, attempt.generation.id);
  assert.deepEqual(f.store.getStory(f.story.id), before);
  assert.throws(() => f.store.beginTurn(f.story.id, { ...first, text: 'Different body.' }), { code: 'invalid' });
  const snapshotCount = f.store.load(f.story.id).generations.filter(g => g.baseSnapshot).length;
  assert.equal(snapshotCount, 1, 'only the latest replaceable turn needs a full state snapshot');
  assert.equal(f.store.load(f.story.id).generations.filter(g => g.context).length, 1, 'historical prompt copies must not accumulate per turn');
  const restored = new Store(':memory:'); t.after(() => restored.close());
  importData(restored, exportData(f.store, { includeHistory: true }));
  assert.equal(restored.beginTurn(f.story.id, first).generation.id, attempt.generation.id);
  assert.deepEqual(restored.getStory(f.story.id), before);
});

test('independent QA: valid short source IDs can exceed five thousand selected references without breaking history recovery', t => {
  const store = new Store(':memory:'), restored = new Store(':memory:');
  t.after(() => { store.close(); restored.close(); });
  const character = store.createCharacter({ name: 'Original archivist', definition: 'An adult archivist.' });
  const persona = store.createPersona({ name: 'Original visitor', definition: 'An adult visitor.' });
  const created = store.createStory({ characterId: character.id, personaId: persona.id, title: 'Synthetic imported short identifiers' });
  const story = store.load(created.id);
  for (let i = 0; i < 7000; i++) story.messages.push({ id: i.toString(36), role: 'user', text: 'x', createdAt: '2026-11-05' });
  for (let i = 0; i < 430; i++) story.memories.push({ id: `memory-${i}`, key: `key.${i}`, text: 'x', kind: 'fact', sources: story.messages.slice(i * 16, (i + 1) * 16).map(m => m.id), revision: 0, pinned: false, corrected: false });
  store.save(story);
  const attempt = store.beginTurn(created.id, { requestId: 'short-identifiers', text: 'Proceed.' });
  assert.ok(attempt.context.sourceIds.length > 5000);
  assert.ok(Buffer.byteLength(JSON.stringify(attempt.context)) <= 128000);
  store.finishTurn(created.id, attempt.generation.id, blank());
  importData(restored, exportData(store, { includeHistory: true }));
  assert.deepEqual(restored.getStory(created.id), store.getStory(created.id));
});

test('independent QA: thought prompt compaction preserves request replay and latest reply replacement after recovery', t => {
  const f = fixture(t);
  const turn = f.store.beginTurn(f.story.id, { requestId: 'before-thoughts', text: 'The archive remains quiet.' });
  f.store.finishTurn(f.story.id, turn.generation.id, blank());
  for (let i = 0; i < 3; i++) {
    const thought = f.store.beginThought(f.story.id, { requestId: `thought-${i}` });
    f.store.finishThought(f.story.id, thought.request.requestId, { text: 'SYNTHETIC QA: I enjoy this quiet archive.', sources: [turn.generation.userMessageId] });
  }
  const state = f.store.load(f.story.id);
  assert.equal(state.generations.filter(g => g.context).length, 0);
  assert.equal(state.generations.filter(g => g.baseSnapshot).length, 1);
  assert.equal(state.thoughtRequests.filter(r => r.context).length, 1);
  const before = f.store.getStory(f.story.id);
  assert.equal(f.store.beginThought(f.story.id, { requestId: 'thought-0' }).request.status, 'completed');
  assert.deepEqual(f.store.getStory(f.story.id), before);
  const restored = new Store(':memory:'); t.after(() => restored.close());
  importData(restored, exportData(f.store, { includeHistory: true }));
  assert.equal(restored.beginThought(f.story.id, { requestId: 'thought-0' }).request.status, 'completed');
  const replacement = restored.beginReplacement(f.story.id, { requestId: 'after-thoughts', generationId: turn.generation.id, revision: before.revision });
  restored.finishTurn(f.story.id, replacement.generation.id, blank());
  const final = restored.load(f.story.id);
  assert.equal(final.thoughtRequests.filter(r => r.context).length, 0);
  assert.equal(final.generations.filter(g => g.context).length, 1);
  assert.ok(!final.messages.some(m => m.kind === 'thought' && !m.superseded));
});

test('independent QA: protected-context exhaustion is actionable over HTTP and does not invoke provider or save a partial send', async t => {
  const f = fixture(t);
  const story = f.store.load(f.story.id);
  for (const memory of story.memories.slice(0, 100)) { memory.pinned = true; memory.text = 'Original protected archive information. '.repeat(45); }
  f.store.save(story);
  let calls = 0;
  const password = 'synthetic-large-state-password';
  const app = createApplication({ store: f.store, provider: { name: 'fake', async generate() { calls++; return blank(); } }, password });
  f.app = app;
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  const login = await fetch(origin + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const before = f.store.getStory(f.story.id);
  const result = await fetch(origin + `/api/stories/${f.story.id}/turns`, { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: 'protected-overflow', text: 'Continue the archive visit.' }) });
  const body = await result.json();
  assert.equal(body.error.code, 'context_limit');
  assert.match(body.error.message, /pin|correct|protect/i);
  assert.equal(calls, 0);
  assert.deepEqual(f.store.getStory(f.story.id), before);
});
