import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Store } from '../app/store.mjs';
import { MediaStore } from '../app/media.mjs';
import { createApplication } from '../app/server.mjs';
import { acquireRuntimeLock } from '../prototype/runtime-lock.mjs';

const port = Number(process.env.STORYCHAT_REDESIGN_PORT || 8801);
const host = process.env.STORYCHAT_REDESIGN_BIND_ADDRESS || '127.0.0.1';
const root = resolve(host === '127.0.0.1' ? 'data/storychat-redesign-preview' : 'data/storychat-redesign-lan-preview');
const origin = `http://${host}:${port}`;
const password = 'synthetic-preview-password';
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Invalid preview port.');
await mkdir(root, { recursive: true });
const lock = await acquireRuntimeLock(resolve(root, 'preview.sqlite.lock'));
const store = new Store(resolve(root, 'preview.sqlite'));
const media = new MediaStore(resolve(root, 'media'));
await media.init();

async function cover(filename) {
  const bytes = await readFile(resolve('data/storychat-concept', filename)).catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  return bytes ? (await media.upload(bytes)).id : '';
}

function seedHistory(story, factCount) {
  const facts = [
    'Mara keeps the spare fuse in drawer four.',
    'The depot clock runs seven minutes slow.',
    'Ivo carries a blue carpenter’s pencil.',
    'The east platform lamp has a loose wire.',
    'The ticket hall closes at midnight.',
    'The night clerk is named Ada.',
    'The west siding can hold one tram.',
    'The north gate opens inward.',
    'The waiting room stove is out of fuel.',
    'The spare route map is folded inside the timetable.'
  ];
  store.change(story.id, draft => {
    const base = Date.now() - 110 * 60000;
    const message = (role, text, minute) => {
      const id = randomUUID();
      draft.messages.push({ id, role, text, createdAt: new Date(base + minute * 60000).toISOString() });
      return id;
    };
    const sourceIds = [];
    for (let n = 0; n < 44; n++) {
      message('user', n % 2 ? 'I open the dispatch ledger. “What should we record before we move on?”' : '*I set the route map under the lamp.* “Show me what you found.”', n * 2);
      const fact = facts[n % facts.length];
      const lastTag = n === 0 && factCount > 21 ? ' “The ledger also lists calibration tag 3020 for a signal relay.”' : '';
      sourceIds.push(message('assistant', `*Mara turns the page and checks the margin against her notes.* “${fact}”${lastTag}\n\n*Beyond the workshop, rain rattles through the gutter. She sets the pencil beside the ledger and waits for Ivo to finish reading.*`, n * 2 + 1));
    }
    message('user', 'I set the station key between us. “Can you get it back to me before the morning shift?”', 90);
    const keySource = message('assistant', '*Mara wiped grease from her thumb before picking up the key.* “Before dawn. I’ll bring the key back before the first bell. You have my word.”\n\n*She held the route map flat under the lamp.* “If the river road floods, I’ll go by the old cutting. Would you mark it for me?”', 91);
    for (let n = 0; n < factCount - 1; n++) {
      const text = facts[n] || `The depot ledger lists calibration tag ${n + 1} for a signal relay.`;
      draft.memories.push({ id: randomUUID(), kind: 'fact', key: `review.fact.${n + 1}`, text, sources: [sourceIds[n < facts.length ? n : 0]], revision: 0, pinned: n === 1, corrected: false });
    }
    draft.memories.push({ id: randomUUID(), kind: 'fact', key: 'station.key', text: 'Ivo lent Mara the station key.', sources: [keySource], revision: 0, pinned: false, corrected: false });
    draft.scene = { text: 'Mara and Ivo are reviewing the route map at the East Depot.', fictionalTime: '23:48', sources: [keySource] };
    draft.threads.push({ id: randomUUID(), key: 'return.key', status: 'pending', text: 'Mara promised to return the station key before dawn.', sources: [keySource], revision: 0 });
    draft.relationship.push({ id: randomUUID(), key: 'route.trust', text: 'Mara trusts Ivo to mark her fallback route.', sources: [keySource], revision: 0 });
    draft.messages.push({ id: randomUUID(), role: 'assistant', kind: 'thought', origin: 'generated', text: 'He trusted me with the key. I can at least show him how I plan to get it back.', sources: [keySource], createdAt: new Date(base + 92 * 60000).toISOString() });
    store.summarize(draft);
  });
}

if (!store.library().characters.length) {
  const [scene, ivoPortrait, nellaPortrait, orenPortrait] = await Promise.all(['scene.webp', 'ivo.webp', 'nella.webp', 'oren.webp'].map(cover));
  const mara = store.createCharacter({ name: 'Mara Voss', definition: 'An adult tram mechanic. Practical, observant, and sparing with promises.', opening: 'A lamp burns inside the depot. *Mara sets down her wrench when she hears your steps.*', subtitle: 'Tram mechanic', cover: scene, focalPoint: { x: 0.68, y: 0.36 } });
  const oren = store.createCharacter({ name: 'Oren Vale', definition: 'An adult lighthouse keeper who keeps weather notes in the margins of tide tables.', opening: '*Oren lifts the lantern-room latch.* “Leave the light on for the boats.”', subtitle: 'Lighthouse keeper', cover: orenPortrait });
  const ivo = store.createPersona({ name: 'Ivo', definition: 'An adult traveling sign painter who takes overnight jobs.', age: 32, cover: ivoPortrait });
  const nella = store.createPersona({ name: 'Nella', definition: 'An adult night courier who knows the eastern alleys.', age: 31, cover: nellaPortrait });
  store.createStory({ characterId: oren.id, personaId: ivo.id, title: 'The Salt House' });
  store.createStory({ characterId: mara.id, personaId: nella.id, title: 'Signal in the Fog' });
  seedHistory(store.createStory({ characterId: mara.id, personaId: ivo.id, title: 'The Last Tram — 21 facts' }), 21);
  seedHistory(store.createStory({ characterId: mara.id, personaId: ivo.id, title: 'The Last Tram' }), 3021);
}

const provider = {
  name: 'fake',
  model: 'synthetic-redesign-preview',
  async generate(context) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (context.messages.at(-1)?.text.includes('[simulate failure]')) throw Object.assign(Error('Synthetic failure'), { code: 'provider_unavailable' });
    return { reply: 'FAKE DEMO — *Mara angles the map toward the lamp.* “Let’s mark the sheltered route together.”', memories: [], threads: [], relationship: [], thoughts: [], scene: null };
  },
  async generateThought(context) {
    await new Promise(resolve => setTimeout(resolve, 800));
    return { text: 'FAKE DEMO — Ivo has given me room to decide. I can do the same for him.', sources: [context.messages.at(-1).id] };
  }
};
const app = createApplication({ store, media, provider, password, origin });
try {
  await new Promise((accept, reject) => {
    app.server.once('error', reject);
    app.server.listen(port, host, accept);
  });
} catch (error) {
  await app.close();
  await lock.release();
  throw error;
}
console.log(`Synthetic redesign preview: ${origin}/ | Password: ${password} | Fake inference only`);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    await app.close();
    await lock.release();
    process.exit(0);
  });
}
