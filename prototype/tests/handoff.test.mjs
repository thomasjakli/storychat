import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, lstat, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { Vault } from '../vault.mjs';
import { prepareHandoff, exportHandoff, importHandoff } from '../handoff.mjs';

const idFor = account => createHash('sha256').update(account.client_id + '\0' + account.subject).digest('hex').slice(0, 16);
const record = suffix => ({ client_id: 'synthetic-' + suffix, subject: 'synthetic-owner-' + suffix, issuer: 'https://auth.openai.com',
  access_token: 'SYNTHETIC_ACCESS_' + suffix, refresh_token: 'SYNTHETIC_REFRESH_' + suffix, id_token: 'SYNTHETIC_ID_' + suffix,
  email: 'owner@example.invalid', scopes: ['chatgpt.tokens.use.direct', 'offline_access'], expires_at: Date.now() + 3600000 });
async function setup(t) {
  const path = await mkdtemp(join(tmpdir(), 'storychat-handoff-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  const vault = name => new Vault(join(path, name, 'data'), join(path, name, 'keys'));
  const source = vault('source'), destination = vault('destination');
  const selected = record('selected'), other = record('other'), id = idFor(selected), otherId = idFor(other);
  await source.locked(async () => { const data = await source.load(); data.accounts = { [id]: selected, [otherId]: other }; await source.save(data); });
  return { path, source, destination, vault, id, otherId, selected, other, request: join(path, 'request.json'), bundle: join(path, 'bundle.json') };
}
const load = vault => vault.locked(() => vault.load());
const json = async path => JSON.parse(await readFile(path, 'utf8'));

test('handoff moves only selected session, preserves host IDs, encrypts bundle and ignores idempotent replay after rotation', async t => {
  const f = await setup(t), sourceHost = (await load(f.source)).hostId;
  const prepared = await prepareHandoff(f.destination, f.request);
  const repeated = await prepareHandoff(f.destination, f.request);
  assert.deepEqual(repeated, prepared);
  const request = await json(f.request);
  assert.ok(!JSON.stringify(request).includes('PRIVATE KEY'));
  const keyFile = join(f.destination.keyDirectory, 'handoff-' + request.requestId + '.pem');
  assert.ok((await readFile(keyFile, 'utf8')).includes('PRIVATE KEY'));
  if (process.platform !== 'win32') assert.equal((await lstat(keyFile)).mode & 0o077, 0);
  const exported = await exportHandoff(f.source, f.id, f.request, f.bundle);
  assert.equal(exported.sourceDisconnected, true);
  const serialized = await readFile(f.bundle, 'utf8');
  assert.ok(!serialized.includes('SYNTHETIC_')); assert.ok(!serialized.includes(f.id));
  const after = await load(f.source);
  assert.equal(after.hostId, sourceHost); assert.deepEqual(after.accounts[f.otherId], f.other);
  assert.equal(after.accounts[f.id].refresh_token, undefined); assert.equal(after.accounts[f.id].client_id, f.selected.client_id);
  assert.deepEqual(await importHandoff(f.destination, f.bundle), { accountId: f.id, requestId: request.requestId, alreadyImported: false });
  assert.equal((await load(f.destination)).hostId, prepared.targetHostId);
  await assert.rejects(readFile(keyFile), { code: 'ENOENT' });
  await f.destination.locked(async () => { const data = await f.destination.load(); data.accounts[f.id].refresh_token = 'SYNTHETIC_ROTATED_NEW'; await f.destination.save(data); });
  const newer = await load(f.destination);
  assert.equal((await importHandoff(new Vault(f.destination.directory, f.destination.keyDirectory), f.bundle)).alreadyImported, true);
  assert.deepEqual(await load(f.destination), newer);
});

test('failed publication and process crash recover identical ciphertext without restoring desktop token use', async t => {
  const f = await setup(t); await prepareHandoff(f.destination, f.request);
  let attempted;
  await assert.rejects(exportHandoff(f.source, f.id, f.request, f.bundle, { writeOutput: async (_output, bundle) => { attempted = bundle; throw Error('synthetic disk failure'); } }), { code: 'handoff_output' });
  assert.equal((await load(f.source)).accounts[f.id].refresh_token, undefined);
  await exportHandoff(new Vault(f.source.directory, f.source.keyDirectory), f.id, f.request, f.bundle);
  assert.deepEqual(await json(f.bundle), attempted);
  await exportHandoff(f.source, f.id, f.request, f.bundle); // Existing identical file is accepted.
  assert.deepEqual(await json(f.bundle), attempted);
  await importHandoff(f.destination, f.bundle);
  assert.equal((await load(f.destination)).accounts[f.id].refresh_token, f.selected.refresh_token);
});

test('crash after source atomic save retains recovery journal; failure before save retains source session', async t => {
  const f = await setup(t); await prepareHandoff(f.destination, f.request);
  const save = f.source.save.bind(f.source);
  f.source.save = async data => { await save(data); throw Error('synthetic crash after commit'); };
  await assert.rejects(exportHandoff(f.source, f.id, f.request, f.bundle), /synthetic crash/);
  f.source.save = save;
  assert.equal((await load(f.source)).accounts[f.id].access_token, undefined);
  await exportHandoff(f.source, f.id, f.request, f.bundle);
  const g = await setup(t); await prepareHandoff(g.destination, g.request);
  g.source.save = async () => { throw Error('synthetic precommit failure'); };
  await assert.rejects(exportHandoff(g.source, g.id, g.request, g.bundle), /synthetic precommit/);
  assert.equal((await load(g.source)).accounts[g.id].refresh_token, g.selected.refresh_token);
});

test('wrong recipient, tampering, stale lifetime and unknown schemas never import credentials', async t => {
  const f = await setup(t); await prepareHandoff(f.destination, f.request); await exportHandoff(f.source, f.id, f.request, f.bundle);
  const wrong = f.vault('wrong'); await prepareHandoff(wrong, join(f.path, 'wrong-request.json'));
  await assert.rejects(importHandoff(wrong, f.bundle), { code: 'handoff_recipient' });
  const original = await json(f.bundle);
  for (const [field, mutate, code] of [
    ['ciphertext', value => (value[0] === 'A' ? 'B' : 'A') + value.slice(1), 'handoff_recipient'],
    ['tag', value => (value[0] === 'A' ? 'B' : 'A') + value.slice(1), 'handoff_recipient'],
    ['version', () => 99, 'handoff_invalid']
  ]) {
    const altered = { ...original, [field]: mutate(original[field]) }, path = join(f.path, field + '.json');
    await writeFile(path, JSON.stringify(altered));
    await assert.rejects(importHandoff(f.destination, path), { code });
  }
  await assert.rejects(importHandoff(f.destination, f.bundle, { now: original.expiresAt }), { code: 'handoff_expired' });
  assert.deepEqual((await load(f.destination)).accounts, {});
});

test('unsafe outputs, weak public keys, mismatched account IDs and active destination records fail closed', async t => {
  const f = await setup(t); await prepareHandoff(f.destination, f.request);
  for (const output of [f.source.file, f.source.keyFile, join(f.source.directory, '.lock')]) await assert.rejects(exportHandoff(f.source, f.id, f.request, output), { code: 'handoff_output' });
  const request = await json(f.request);
  request.publicKey = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } }).publicKey;
  const weak = join(f.path, 'weak.json'); await writeFile(weak, JSON.stringify(request));
  await assert.rejects(exportHandoff(f.source, f.id, weak, f.bundle), { code: 'handoff_invalid' });
  assert.equal((await load(f.source)).accounts[f.id].refresh_token, f.selected.refresh_token);
  await f.source.locked(async () => { const data = await f.source.load(); data.accounts.wrong = f.selected; await f.source.save(data); });
  await assert.rejects(exportHandoff(f.source, 'wrong', f.request, f.bundle), { code: 'handoff_account' });
  await exportHandoff(f.source, f.id, f.request, f.bundle);
  await f.destination.locked(async () => { const data = await f.destination.load(); data.accounts[f.id] = { ...f.selected, refresh_token: 'SYNTHETIC_NEWER_ACTIVE' }; await f.destination.save(data); });
  const before = await load(f.destination);
  await assert.rejects(importHandoff(f.destination, f.bundle), { code: 'handoff_active' });
  assert.deepEqual(await load(f.destination), before);
});

test('prepare does not republish a pending request after its recipient private key is lost', async t => {
  const f = await setup(t), prepared = await prepareHandoff(f.destination, f.request);
  await unlink(join(f.destination.keyDirectory, 'handoff-' + prepared.requestId + '.pem'));
  await assert.rejects(prepareHandoff(f.destination, join(f.path, 'republished.json')), { code: 'handoff_recipient' });
  await assert.rejects(readFile(join(f.path, 'republished.json')), { code: 'ENOENT' });
  assert.equal((await load(f.source)).accounts[f.id].refresh_token, f.selected.refresh_token);
});

test('journal publication retry after source reauthorization preserves new credentials and fails closed', async t => {
  const f = await setup(t); await prepareHandoff(f.destination, f.request);
  await assert.rejects(exportHandoff(f.source, f.id, f.request, f.bundle, { writeOutput: async () => { throw Error('synthetic publication failure'); } }), { code: 'handoff_output' });
  await f.source.locked(async () => {
    const data = await f.source.load();
    data.accounts[f.id] = { ...f.selected, access_token: 'SYNTHETIC_REAUTHORIZED_ACCESS', refresh_token: 'SYNTHETIC_REAUTHORIZED_REFRESH' };
    await f.source.save(data);
  });
  const before = await load(f.source);
  let published = false;
  await assert.rejects(exportHandoff(f.source, f.id, f.request, f.bundle, { writeOutput: async () => { published = true; } }), { code: 'handoff_source_active' });
  assert.equal(published, false); assert.deepEqual(await load(f.source), before);
  await assert.rejects(readFile(f.bundle), { code: 'ENOENT' });
});
