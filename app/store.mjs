import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const kinds = ['fact', 'belief', 'event'];
const statuses = ['pending', 'completed', 'cancelled', 'superseded'];
const controlsDefault = { tone: 'Natural', detail: 'balanced', length: 'medium' };
const id = () => randomUUID();
const now = () => new Date().toISOString();
const copy = value => structuredClone(value);
const normalized = value => value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
function error(code, message) { return Object.assign(new Error(message), { code }); }
function check(condition, message = 'Invalid story data.') { if (!condition) throw error('invalid', message); }
function text(value, max = 2000) { check(typeof value === 'string' && value.trim().length > 0 && value.length <= max); return value.trim(); }
function object(value, keys, required = keys) { check(value && typeof value === 'object' && !Array.isArray(value)); check(Object.keys(value).every(key => keys.includes(key)) && required.every(key => Object.hasOwn(value, key))); }
const stringSchema = maxLength => ({ type: 'string', minLength: 1, maxLength });
const sourcesSchema = { type: 'array', minItems: 1, maxItems: 16, items: stringSchema(100) };
const recordSchema = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const common = { key: stringSchema(120), text: stringSchema(2000), sources: sourcesSchema };
const listSchema = item => ({ type: 'array', maxItems: 16, items: item });
export const outputSchema = recordSchema({
  reply: stringSchema(12000),
  memories: listSchema(recordSchema({ kind: { type: 'string', enum: kinds }, ...common })),
  threads: listSchema(recordSchema({ ...common, status: { type: 'string', enum: statuses } })),
  relationship: listSchema(recordSchema(common)),
  thoughts: listSchema(recordSchema(common)),
  scene: { anyOf: [{ type: 'null' }, recordSchema({ text: stringSchema(2000), fictionalTime: stringSchema(200), sources: sourcesSchema })] },
});

export function validateOutput(output, sourceIds) {
  object(output, ['reply', 'memories', 'threads', 'relationship', 'thoughts', 'scene']);
  text(output.reply, 12000);
  const allowed = new Set(sourceIds);
  const sources = value => { check(Array.isArray(value) && value.length >= 1 && value.length <= 16 && value.every(source => typeof source === 'string' && allowed.has(source)), 'Unknown or missing source message.'); };
  for (const name of ['memories', 'threads', 'relationship', 'thoughts']) {
    const records = output[name];
    check(Array.isArray(records) && records.length <= 16);
    const seen = new Set();
    for (const record of records) {
      object(record, ['key', 'text', 'sources', ...(name === 'memories' ? ['kind'] : name === 'threads' ? ['status'] : [])]);
      text(record.key, 120); text(record.text); sources(record.sources);
      if (name === 'memories') check(kinds.includes(record.kind));
      if (name === 'threads') check(statuses.includes(record.status));
      const signature = `${record.kind ?? ''}:${record.key}:${normalized(record.text)}`;
      check(!seen.has(signature), 'Duplicate state proposal.'); seen.add(signature);
    }
  }
  if (output.scene !== null) { object(output.scene, ['text', 'fictionalTime', 'sources']); text(output.scene.text); text(output.scene.fictionalTime, 200); sources(output.scene.sources); }
  return copy(output);
}

export class Store {
  constructor(path) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS library(id TEXT PRIMARY KEY, type TEXT NOT NULL, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS stories(id TEXT PRIMARY KEY, data TEXT NOT NULL);');
    this.transaction(() => {
      for (const row of this.db.prepare('SELECT data FROM stories').all()) {
        const story = JSON.parse(row.data); let changed = false;
        for (const generation of story.generations) if (generation.status === 'pending') { generation.status = 'interrupted'; generation.error = 'interrupted'; changed = true; }
        if (changed) this.save(story);
      }
    });
  }
  transaction(fn) { this.db.exec('BEGIN IMMEDIATE'); try { const result = fn(); this.db.exec('COMMIT'); return result; } catch (failure) { this.db.exec('ROLLBACK'); throw failure; } }
  save(story) { this.db.prepare('INSERT OR REPLACE INTO stories(id,data) VALUES(?,?)').run(story.id, JSON.stringify(story)); }
  load(storyId) { const row = this.db.prepare('SELECT data FROM stories WHERE id=?').get(storyId); if (!row) throw error('not_found', 'Story not found.'); return JSON.parse(row.data); }
  publicStory(story) { const result = copy(story); delete result.suppression; for (const generation of result.generations) { delete generation.context; } return result; }
  getStory(storyId) { return this.publicStory(this.load(storyId)); }
  library() { const rows = this.db.prepare('SELECT type,data FROM library').all(); return { characters: rows.filter(r => r.type === 'character').map(r => JSON.parse(r.data)), personas: rows.filter(r => r.type === 'persona').map(r => JSON.parse(r.data)), stories: this.db.prepare('SELECT data FROM stories').all().map(r => { const s = JSON.parse(r.data); return { id: s.id, title: s.title, character: s.character, persona: s.persona, revision: s.revision }; }) }; }
  createDefinition(type, data) {
    object(data, ['name', 'definition', ...(type === 'character' ? ['opening'] : [])], ['name', 'definition']);
    const record = { id: id(), name: text(data.name, 100), definition: text(data.definition, 8000), version: 1, createdAt: now() };
    if (type === 'character') record.opening = data.opening ? text(data.opening, 4000) : '';
    this.db.prepare('INSERT INTO library(id,type,data) VALUES(?,?,?)').run(record.id, type, JSON.stringify(record)); return record;
  }
  createCharacter(data) { return this.createDefinition('character', data); }
  createPersona(data) { return this.createDefinition('persona', data); }
  definition(recordId, type) { const row = this.db.prepare('SELECT data FROM library WHERE id=? AND type=?').get(recordId, type); if (!row) throw error('not_found', 'Definition not found.'); return JSON.parse(row.data); }
  createStory(data) {
    object(data, ['characterId', 'personaId', 'title']);
    const character = this.definition(data.characterId, 'character'); const persona = this.definition(data.personaId, 'persona');
    const story = { id: id(), title: text(data.title, 120), character, persona, controls: copy(controlsDefault), revision: 0, scene: null, messages: [], memories: [], threads: [], relationship: [], thoughts: [], summary: '', generations: [], suppression: [] };
    if (character.opening) story.messages.push({ id: id(), role: 'assistant', text: character.opening, createdAt: now() });
    this.save(story); return this.publicStory(story);
  }
  change(storyId, operation) { return this.transaction(() => { const story = this.load(storyId); operation(story); this.save(story); return this.publicStory(story); }); }
  setControls(storyId, controls) { object(controls, ['tone', 'detail', 'length']); text(controls.tone, 100); check(['minimal', 'balanced', 'rich'].includes(controls.detail) && ['short', 'medium', 'long'].includes(controls.length)); return this.change(storyId, story => { story.controls = copy(controls); }); }
  summarize(story) { story.summary = [...story.memories.map(m => `[${m.kind}${m.conflict ? ', conflicting' : ''}] ${m.text}`), ...story.threads.map(t => `[${t.status}] ${t.text}`), ...story.relationship.map(r => `[relationship] ${r.text}`)].join('\n').slice(0, 12000); }
  editMemory(storyId, memoryId, changes) {
    object(changes, ['text', 'pinned'], []); check(Object.keys(changes).length > 0); if (Object.hasOwn(changes, 'text')) text(changes.text); if (Object.hasOwn(changes, 'pinned')) check(typeof changes.pinned === 'boolean');
    return this.change(storyId, story => {
      const memory = story.memories.find(m => m.id === memoryId); if (!memory) throw error('not_found', 'Memory not found.');
      if (Object.hasOwn(changes, 'text')) {
        const originals = story.memories.filter(m => normalized(m.key) === normalized(memory.key)).map(copy);
        for (const original of originals) story.suppression.push({ key: original.key, text: normalized(original.text), reason: 'correction' });
        story.memories = story.memories.filter(m => normalized(m.key) !== normalized(memory.key) || m.id === memoryId);
        memory.text = text(changes.text); memory.corrected = true; memory.conflict = false;
        for (const category of ['threads', 'relationship', 'thoughts']) story[category] = story[category].filter(r => !originals.some(m => normalized(r.key) === normalized(m.key) || normalized(r.text).includes(normalized(m.text))));
        if (story.scene && originals.some(m => normalized(`${story.scene.text} ${story.scene.fictionalTime}`).includes(normalized(m.text)))) story.scene = null;
      }
      if (Object.hasOwn(changes, 'pinned')) memory.pinned = changes.pinned;
      memory.revision = ++story.revision; this.summarize(story);
    });
  }
  deleteMemory(storyId, memoryId) { return this.change(storyId, story => {
    const memory = story.memories.find(m => m.id === memoryId); if (!memory) throw error('not_found', 'Memory not found.');
    story.suppression.push({ key: memory.key, text: normalized(memory.text), reason: 'deletion' }); story.memories = story.memories.filter(m => m.id !== memoryId);
    for (const category of ['threads', 'relationship', 'thoughts']) story[category] = story[category].filter(entry => normalized(entry.key) !== normalized(memory.key) && !normalized(entry.text).includes(normalized(memory.text)));
    if (story.scene && normalized(`${story.scene.text} ${story.scene.fictionalTime}`).includes(normalized(memory.text))) story.scene = null;
    story.revision++; this.summarize(story);
  }); }
  deleteStory(storyId) { this.transaction(() => { this.load(storyId); this.db.prepare('DELETE FROM stories WHERE id=?').run(storyId); }); }
  buildContext(story) {
    const messages = story.messages.slice(-6).map(copy);
    const query = normalized(messages.at(-1)?.text ?? '').match(/[\p{L}\p{N}]{3,}/gu) ?? [];
    const score = m => query.reduce((total, word) => total + (normalized(m.text).includes(word) ? 1 : 0), 0);
    const pinned = story.memories.filter(m => m.pinned);
    const selected = [...pinned, ...story.memories.filter(m => !m.pinned).sort((a, b) => score(b) - score(a)).slice(0, Math.max(0, 24 - pinned.length))];
    const context = { character: story.character, persona: story.persona, controls: story.controls, revision: story.revision, scene: story.scene, memories: selected, threads: story.threads.slice(-24), relationship: story.relationship.slice(-16), thoughts: story.thoughts.slice(-8), summary: story.summary, messages, suppression: copy(story.suppression), instructions: 'Use only established story evidence. Suppressed keys and text must never be restored. Corrections take priority. Real elapsed time does not advance fictional time. Thoughts are authored fictional narration, never model reasoning.' };
    context.sourceIds = [...new Set([...messages.map(m => m.id), ...[...story.memories, ...story.threads, ...story.relationship, ...story.thoughts, ...(context.scene ? [context.scene] : [])].flatMap(m => m.sources)])];
    // A fixed ceiling fails safely rather than silently dropping protected facts.
    check(JSON.stringify(context).length <= 120000, 'Story context budget reached; remove unneeded state before continuing.');
    return copy(context);
  }
  beginTurn(storyId, data) {
    object(data, ['requestId', 'text']); text(data.requestId, 100); text(data.text, 8000);
    return this.transaction(() => {
      const story = this.load(storyId); const existing = story.generations.find(g => g.requestId === data.requestId);
      if (existing) { check(story.messages.find(m => m.id === existing.userMessageId)?.text === data.text.trim(), 'Request ID already has different text.'); return { generation: copy(existing), context: copy(existing.context) }; }
      if (story.generations.some(g => g.status === 'pending')) throw error('conflict', 'This story already has a pending reply.');
      check(story.messages.length < 20000 && story.generations.length < 10000, 'Prototype story limit reached.');
      const message = { id: id(), role: 'user', text: text(data.text, 8000), createdAt: now() }; story.messages.push(message);
      const context = this.buildContext(story);
      const generation = { id: id(), requestId: data.requestId, userMessageId: message.id, status: 'pending', revision: story.revision, createdAt: now(), context };
      story.generations.push(generation); this.save(story); return { generation: copy(generation), context };
    });
  }
  finishTurn(storyId, generationId, result) {
    return this.change(storyId, story => {
      const generation = story.generations.find(g => g.id === generationId); if (!generation) throw error('not_found', 'Generation not found.');
      if (generation.status === 'completed') return;
      if (generation.status !== 'pending') throw error('conflict', 'Generation is no longer pending.');
      if (generation.revision !== story.revision) throw error('conflict', 'Story changed while the reply was being generated.');
      const output = validateOutput(result, generation.context.sourceIds);
      const suppressed = entry => story.suppression.some(s => normalized(s.key) === normalized(entry.key) || normalized(entry.text).includes(s.text));
      const revision = story.revision + 1;
      for (const proposal of output.memories) {
        if (suppressed(proposal)) continue;
        const same = story.memories.find(m => normalized(m.key) === normalized(proposal.key) && m.kind === proposal.kind && normalized(m.text) === normalized(proposal.text));
        if (same) { same.sources = [...new Set([...same.sources, ...proposal.sources])].slice(0, 16); continue; }
        story.memories.push({ ...proposal, id: id(), pinned: false, corrected: false, revision });
      }
      for (const memory of story.memories) memory.conflict = memory.kind === 'fact' && story.memories.some(other => other.id !== memory.id && other.kind === 'fact' && normalized(other.key) === normalized(memory.key) && normalized(other.text) !== normalized(memory.text));
      for (const category of ['threads', 'relationship', 'thoughts']) for (const proposal of output[category]) {
        if (suppressed(proposal)) continue;
        const existing = story[category].find(m => normalized(m.key) === normalized(proposal.key));
        if (category === 'threads' && existing && existing.status !== 'pending' && proposal.status === 'pending') continue;
        if (existing) Object.assign(existing, proposal, { revision }); else story[category].push({ ...proposal, id: id(), revision });
      }
      if (output.scene && !story.suppression.some(s => normalized(`${output.scene.text} ${output.scene.fictionalTime}`).includes(s.text))) story.scene = { ...output.scene, revision };
      check(story.memories.length <= 200 && story.threads.length <= 200 && story.relationship.length <= 100 && story.thoughts.length <= 100, 'Prototype state limit reached.');
      story.messages.push({ id: id(), role: 'assistant', text: output.reply, createdAt: now(), generationId });
      generation.status = 'completed'; generation.completedAt = now(); story.revision = revision; this.summarize(story);
    });
  }
  failTurn(storyId, generationId, code = 'provider_error') { return this.change(storyId, story => { const generation = story.generations.find(g => g.id === generationId); if (!generation) throw error('not_found', 'Generation not found.'); if (generation.status === 'pending') { generation.status = 'failed'; generation.error = /^[a-z_]{1,40}$/.test(code) ? code : 'provider_error'; } }); }
  close() { this.db.close(); }
}
