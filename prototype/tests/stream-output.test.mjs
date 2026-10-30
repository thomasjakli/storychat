import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeResponse } from '../stream.mjs';
import { validateEnvelope } from '../output.mjs';
import { checkedFetch } from '../errors.mjs';

const event = value => `data: ${JSON.stringify(value)}\r\n\r\n`;
const delta = text => ({ type: 'response.output_text.delta', delta: text });
const completed = { type: 'response.completed', response: { status: 'completed' } };
async function* chunks(text, width = 1) {
  const bytes = new TextEncoder().encode(text);
  for (let i = 0; i < bytes.length; i += width) yield bytes.slice(i, i + width);
}
const envelope = { reply: 'Mira remembers the promise.', memories: [{ kind: 'intention', text: 'Meet at the bridge.', source: 'user-1' }] };

test('SSE preserves Unicode and CRLF across byte boundaries', async () => {
  const observed = [];
  assert.equal(await consumeResponse(chunks(event(delta('Grüße 🌲')) + event(completed)), value => observed.push(value)), 'Grüße 🌲');
  assert.deepEqual(observed, ['Grüße 🌲']);
});
test('SSE cannot accept DONE without a successful response terminal', async () => {
  await assert.rejects(consumeResponse(chunks(event(delta('partial')) + 'data: [DONE]\n\n')), { code: 'interrupted' });
});
test('allowance denial after visible partial output rejects whole generation', async () => {
  const observed = [];
  await assert.rejects(consumeResponse(chunks(event(delta('partial')) + event({ type: 'response.failed', response: { error: { code: 'usage_limit_reached' } } })), x => observed.push(x)), { code: 'usage_limit_reached' });
  assert.deepEqual(observed, ['partial']);
});
test('incomplete, malformed, contradictory, and post-completion streams fail closed', async t => {
  const cases = [
    [event({ type: 'response.incomplete' }), 'response.incomplete'],
    ['data: {broken}\n\n', 'invalid_stream'],
    [event({ type: 'response.completed', response: { status: 'failed' } }), 'invalid_stream'],
    [event(completed) + event(delta('late')), 'invalid_stream'],
    [event(delta(7)), 'invalid_stream'],
  ];
  for (const [stream, code] of cases) await t.test(code, () => assert.rejects(consumeResponse(chunks(stream)), { code }));
});
test('transport failure after partial stream is not a completion', async () => {
  async function* interrupted() { yield new TextEncoder().encode(event(delta('partial'))); throw Error('socket secret'); }
  await assert.rejects(consumeResponse(interrupted()), error => error.code === 'interrupted' && !error.message.includes('socket secret'));
});
test('oversized stream output and event buffers are bounded', async () => {
  await assert.rejects(consumeResponse(chunks(event(delta('x'.repeat(65537))), 4096)), { code: 'output_limit' });
  await assert.rejects(consumeResponse(chunks('x'.repeat(1024 * 1024 + 1), 65536)), { code: 'invalid_stream' });
});
test('complete narrative/state envelope preserves explicit source and intention', () => {
  assert.deepEqual(validateEnvelope(JSON.stringify(envelope), ['user-1']), envelope);
});
test('state envelope rejects injection fields, unknown sources, invalid kinds, and partial JSON', async t => {
  const variants = [
    { ...envelope, owner: 'another-user' },
    { ...envelope, memories: [{ ...envelope.memories[0], source: 'other-story' }] },
    { ...envelope, memories: [{ ...envelope.memories[0], kind: 'execute' }] },
    { ...envelope, memories: [{ ...envelope.memories[0], command: 'run' }] },
    { ...envelope, reply: ' ' },
    { ...envelope, memories: Array(11).fill(envelope.memories[0]) },
    null, [],
  ];
  for (const [i, value] of variants.entries()) await t.test(`invalid envelope ${i}`, () => assert.throws(() => validateEnvelope(JSON.stringify(value), ['user-1']), { code: 'invalid_output' }));
  assert.throws(() => validateEnvelope('{"reply":', ['user-1']), { code: 'invalid_output' });
});
test('HTTP errors redact untrusted provider bodies and never retry automatically', async () => {
  let calls = 0;
  await assert.rejects(checkedFetch(async (_url, options) => {
    calls++;
    assert.equal(options.redirect, 'error');
    return new Response(JSON.stringify({ error: { code: 'invalid_grant', message: 'secret-token' } }), { status: 401 });
  }, 'https://provider.invalid/token'), error => error.code === 'invalid_grant' && !error.message.includes('secret-token'));
  assert.equal(calls, 1);
});
