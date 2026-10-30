import test from 'node:test';
import assert from 'node:assert/strict';
import { ChatGPTProvider, FakeProvider } from '../provider.mjs';
const account = () => ({ client_id: 'synthetic-client', subject: 'synthetic-user', access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', scopes: ['chatgpt.tokens.use.direct'], expires_at: Date.now() + 3600000 });
const catalog = { models: [{ slug: 'available', display_name: 'Test model', visibility: 'list' }, { slug: 'hidden', display_name: 'Hidden', visibility: 'hide' }] };
const envelope = { reply: 'Original synthetic reply.', memories: [{ kind: 'intention', text: 'Bring a map.', source: 'message-1' }] };
const generation = { model: 'available', input: [{ role: 'user', content: 'Synthetic story' }], sourceIds: ['message-1'] };
function stream(events) { return new Response(events.map(value => `data: ${JSON.stringify(value)}\n\n`).join('')); }
test('account catalog filters visibility and refuses unknown model without inference', async () => {
  let calls = 0;
  const provider = new ChatGPTProvider(account(), async () => {}, async url => { calls++; assert.ok(url.endsWith('/models')); return Response.json(catalog); });
  assert.deepEqual(await provider.listModels(), [{ slug: 'available', display_name: 'Test model' }]);
  await assert.rejects(provider.generate({ ...generation, model: 'hidden' }), { code: 'model_unavailable' });
  assert.equal(calls, 2);
  const malformed = new ChatGPTProvider(account(), async () => {}, async () => Response.json({ data: [] }));
  await assert.rejects(malformed.listModels(), { code: 'invalid_catalog' });
});
test('adapter sends history, no storage, streaming, strict schema and returns only validated completion', async () => {
  let inference = 0;
  const provider = new ChatGPTProvider(account(), async () => { throw Error('unexpected persist'); }, async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer synthetic-access');
    if (url.endsWith('/models')) return Response.json(catalog);
    inference++;
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const body = JSON.parse(options.body);
    assert.equal(body.store, false); assert.equal(body.stream, true);
    assert.deepEqual(body.input, generation.input);
    assert.equal(body.text.format.strict, true);
    assert.ok(!('max_output_tokens' in body));
    return stream([{ type: 'response.output_text.delta', delta: JSON.stringify(envelope) }, { type: 'response.completed', response: { status: 'completed' } }]);
  });
  assert.deepEqual(await provider.generate(generation), envelope);
  assert.equal(inference, 1);
});
test('refresh coalesces concurrency, persists rotation before use and does not retry denial', async () => {
  let requests = 0, saved;
  const provider = new ChatGPTProvider({ ...account(), expires_at: 0 }, async replacement => { saved = replacement; }, async (_url, options) => {
    requests++; assert.equal(options.body.get('refresh_token'), 'synthetic-refresh');
    await new Promise(resolve => setTimeout(resolve, 10));
    return Response.json({ access_token: 'rotated-access', refresh_token: 'rotated-refresh', token_type: 'Bearer', expires_in: 3600, scope: 'chatgpt.tokens.use.direct' });
  });
  await Promise.all([provider.refresh(), provider.refresh(), provider.refresh()]);
  assert.equal(requests, 1); assert.equal(saved.refresh_token, 'rotated-refresh'); assert.equal(provider.account.access_token, 'rotated-access');
  const denied = new ChatGPTProvider({ ...account(), expires_at: 0 }, async () => assert.fail('must not persist denial'), async () => { requests++; return Response.json({ error: 'invalid_grant' }, { status: 400 }); });
  await assert.rejects(denied.refresh(), { code: 'invalid_grant' });
  assert.equal(requests, 2);
});
test('failed rotation persistence prevents a following inference request', async () => {
  let requests = 0;
  const provider = new ChatGPTProvider({ ...account(), expires_at: 0 }, async () => { throw Error('disk failure'); }, async () => {
    requests++; return Response.json({ access_token: 'rotated-access', refresh_token: 'rotated-refresh', token_type: 'Bearer', expires_in: 3600 });
  });
  await assert.rejects(provider.listModels(), /disk failure/);
  assert.equal(provider.account.access_token, 'synthetic-access'); assert.equal(requests, 1);
});
test('revoke clears local tokens even when provider confirmation is unavailable and prevents SSRF', async () => {
  let calls = 0, saved;
  const provider = new ChatGPTProvider(account(), async value => { saved = value; }, async () => { calls++; return Response.json({ revocation_endpoint: 'https://attacker.invalid/revoke' }); });
  assert.equal((await provider.revoke()).confirmed, false);
  assert.equal(calls, 1); assert.equal(saved.client_id, 'synthetic-client');
  for (const name of ['access_token', 'refresh_token', 'id_token', 'expires_at', 'scopes']) assert.ok(!(name in saved));
  await assert.rejects(provider.refresh(), { code: 'sign_in_required' });
});
test('revoke confirms provider success and sends only selected refresh token', async () => {
  let calls = 0;
  const provider = new ChatGPTProvider(account(), async () => {}, async (url, options) => {
    calls++;
    if (url.endsWith('openid-configuration')) return Response.json({ revocation_endpoint: 'https://auth.openai.com/revoke' });
    assert.equal(options.body.get('token'), 'synthetic-refresh'); assert.equal(options.body.get('client_id'), 'synthetic-client');
    return new Response(null, { status: 200 });
  });
  assert.equal((await provider.revoke()).confirmed, true); assert.equal(calls, 2);
});
test('fake scenarios are visibly synthetic and cannot stand in for provider success', async () => {
  assert.match((await new FakeProvider().generate()).reply, /^FAKE:/);
  for (const [mode, code] of [['denied', 'subscription_sharing_usage_unavailable'], ['interrupted', 'interrupted'], ['invalid', 'invalid_output']]) await assert.rejects(new FakeProvider(mode).generate(), { code });
});
