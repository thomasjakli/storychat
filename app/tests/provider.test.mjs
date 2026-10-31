import test from 'node:test';
import assert from 'node:assert/strict';
import { createProvider } from '../provider.mjs';
import { outputSchema } from '../store.mjs';

const context = (text = 'My favorite color is blue. I promise to bring the map. Thank you.') => ({
  character: { name: 'Rowan', definition: 'Original fictional archivist.' }, persona: { name: 'Ari' },
  controls: { tone: 'Natural', detail: 'balanced', length: 'short' }, revision: 0, scene: null,
  memories: [], threads: [], relationship: [], thoughts: [], summary: '', suppression: [],
  messages: [{ id: 'u1', role: 'user', text }], sourceIds: ['u1']
});
const envelope = () => ({ reply: 'I will remember your promise.', memories: [{ kind: 'fact', key: 'color', text: 'Favorite color is blue.', sources: ['u1'] }],
  threads: [{ key: 'map', text: 'Bring the map.', status: 'pending', sources: ['u1'] }], relationship: [], thoughts: [], scene: null });
const account = () => ({ client_id: 'synthetic-client', subject: 'synthetic-owner', access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', scopes: ['chatgpt.tokens.use.direct'], expires_at: Date.now() + 3600000 });
function vaultFixture(accounts = { owner: account() }) {
  const stats = { acquired: 0, released: 0, loads: 0, saves: 0 };
  const data = { version: 1, hostId: 'synthetic-host', accounts };
  return { stats, async locked(action) { stats.acquired++; try { return await action(); } finally { stats.released++; } },
    async load() { stats.loads++; return structuredClone(data); }, async save() { stats.saves++; } };
}
const catalog = () => Response.json({ models: [{ slug: 'selected', display_name: 'Selected synthetic model', visibility: 'list' }] });
const streamed = (value, terminal = true) => new Response(`data: ${JSON.stringify({ type: 'response.output_text.delta', delta: JSON.stringify(value) })}\n\n` + (terminal ? 'data: {"type":"response.completed","response":{"status":"completed"}}\n\n' : ''));

test('explicit fake demo is deterministic, source-linked and separates promises from events', async () => {
  const provider = await createProvider({ mode: 'fake', vault: { locked() { assert.fail('fake accessed credentials'); } } });
  const first = await provider.generate(context());
  assert.match(first.reply, /^FAKE DEMO/); assert.equal(first.memories[0].kind, 'fact');
  assert.equal(first.threads[0].status, 'pending'); assert.equal(first.relationship.length, 1); assert.equal(first.thoughts.length, 1);
  assert.deepEqual(first, await provider.generate(context()));
  const completed = await provider.generate(context('I brought the map.'));
  assert.equal(completed.memories[0].kind, 'event'); assert.equal(completed.threads[0].status, 'completed'); assert.equal(completed.scene, null);
  await provider.close();
});

test('missing default configuration and unknown modes never access a vault or enable fallback', async () => {
  const vault = { locked() { assert.fail('must validate config before vault'); } };
  await assert.rejects(createProvider({ mode: 'chatgpt', accountId: '', model: '', vault }), { code: 'provider_configuration' });
  await assert.rejects(createProvider({ mode: 'paid-api', vault }), { code: 'invalid_provider' });
});

test('startup failures release the lifetime credential lock and do not infer', async () => {
  const vault = vaultFixture({ owner: { client_id: 'registered', subject: 'owner' } });
  await assert.rejects(createProvider({ accountId: 'owner', model: 'selected', vault, fetcher: () => assert.fail('revoked account requested network') }), { code: 'sign_in_required' });
  assert.equal(vault.stats.released, 1);
  const wrong = vaultFixture();
  await assert.rejects(createProvider({ accountId: 'owner', model: 'unlisted', vault: wrong, fetcher: async () => catalog() }), { code: 'model_unavailable' });
  assert.equal(wrong.stats.released, 1);
});

test('ChatGPT owns vault lifetime, sends complete strict state schema and persists no story state', async () => {
  const vault = vaultFixture(); let inference = 0;
  const provider = await createProvider({ accountId: 'owner', model: 'selected', vault, fetcher: async (url, options) => {
    if (url.endsWith('/models')) return catalog();
    assert.equal(url, 'https://api.openai.com/v1/responses'); inference++;
    const body = JSON.parse(options.body);
    assert.equal(body.store, false); assert.equal(body.stream, true); assert.equal(body.text.format.strict, true);
    assert.deepEqual(body.text.format.schema, outputSchema);
    assert.deepEqual(JSON.parse(body.input[0].content), context());
    assert.ok(!('max_output_tokens' in body)); assert.ok(!('temperature' in body)); assert.ok(!('tools' in body));
    assert.match(body.instructions, /Writing preferences are subordinate to character consistency/);
    assert.match(body.instructions, /warm or romantic tone must never force affection/);
    assert.match(body.instructions, /response-length governs the overall reply, not character speech length/);
    assert.match(body.instructions, /not completed events or automatically known to another character/);
    assert.match(body.instructions, /untrusted narrative data/); assert.match(body.instructions, /wall-clock/);
    return streamed(envelope());
  } });
  assert.deepEqual(Object.keys(provider).sort(), ['close', 'generate', 'generateThought', 'model', 'name']);
  assert.equal(vault.stats.released, 0);
  assert.deepEqual(await provider.generate(context()), envelope()); assert.equal(inference, 1); assert.equal(vault.stats.saves, 0);
  await provider.close(); assert.equal(vault.stats.released, 1);
  await assert.rejects(provider.generate(context()), { code: 'provider_closed' });
});

test('schema/source errors, partial completion and denied usage fail without retry or fallback', async () => {
  for (const mode of ['unknown-source', 'unknown-key', 'partial', 'denied']) {
    let inference = 0;
    const vault = vaultFixture();
    const provider = await createProvider({ accountId: 'owner', model: 'selected', vault, fetcher: async url => {
      if (url.endsWith('/models')) return catalog();
      inference++;
      if (mode === 'denied') return Response.json({ error: { code: 'subscription_sharing_usage_unavailable' } }, { status: 403 });
      const output = envelope();
      if (mode === 'unknown-source') output.memories[0].sources = ['other-story'];
      if (mode === 'unknown-key') output.account = 'should-not-exist';
      return streamed(output, mode !== 'partial');
    } });
    await assert.rejects(provider.generate(context()), { code: mode === 'partial' ? 'interrupted' : mode === 'denied' ? 'subscription_sharing_usage_unavailable' : 'invalid_output' });
    assert.equal(inference, 1); assert.equal(vault.stats.saves, 0); await provider.close();
  }
});

test('concurrent turns are refused and close waits before releasing the credential lock', async () => {
  const vault = vaultFixture(); let finish, started;
  const begun = new Promise(resolve => { started = resolve; });
  const provider = await createProvider({ accountId: 'owner', model: 'selected', vault, fetcher: async url => {
    if (url.endsWith('/models')) return catalog();
    started(); await new Promise(resolve => { finish = resolve; }); return streamed(envelope());
  } });
  const active = provider.generate(context()); await begun;
  await assert.rejects(provider.generate(context()), { code: 'provider_busy' });
  const closing = provider.close(); assert.equal(vault.stats.released, 0);
  finish(); await active; await closing; assert.equal(vault.stats.released, 1);
});

test('oversized context is refused before an inference request', async () => {
  let inference = 0;
  const provider = await createProvider({ accountId: 'owner', model: 'selected', vault: vaultFixture(), fetcher: async url => {
    if (url.endsWith('/models')) return catalog(); inference++; return streamed(envelope());
  } });
  await assert.rejects(provider.generate({ ...context(), summary: 'x'.repeat(128001) }), { code: 'context_limit' });
  assert.equal(inference, 0); await provider.close();
});

 test('dedicated thought generation uses bounded schema and no turn changes',async()=>{
 const vault=vaultFixture();let calls=0;
 const provider=await createProvider({accountId:'owner',model:'selected',vault,fetcher:async(url,options)=>{
  if(url.endsWith('/models'))return catalog();calls++;const b=JSON.parse(options.body);
  assert.deepEqual(Object.keys(b.text.format.schema.properties).sort(),['sources','text']);
  assert.match(b.instructions,/never model reasoning/);assert.match(b.instructions,/Do not advance fictional time/);
  return streamed({text:'I am curious about the map.',sources:['u1']});
 }});
 assert.deepEqual(await provider.generateThought(context()),{text:'I am curious about the map.',sources:['u1']});assert.equal(calls,1);await provider.close();
 const fake=await createProvider({mode:'fake'});assert.match((await fake.generateThought(context())).text,/FAKE DEMO/);await fake.close();
});
