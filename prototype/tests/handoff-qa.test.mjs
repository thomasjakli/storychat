// Independent adversarial checks. Only temporary synthetic credentials are used.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { Vault } from '../vault.mjs';
import { prepareHandoff, exportHandoff, importHandoff } from '../handoff.mjs';

const marker = 'SYNTHETIC_QA_HANDOFF_SECRET';
const account = suffix => ({ client_id: `synthetic-client-${suffix}`, subject: `synthetic-subject-${suffix}`, issuer: 'https://auth.openai.com', email: 'synthetic@example.invalid', access_token: marker + '_ACCESS_' + suffix, refresh_token: marker + '_REFRESH_' + suffix, id_token: marker + '_ID_' + suffix, scopes: ['openid', 'chatgpt.tokens.use.direct'], expires_at: Date.now() + 3600000 });
const idFor = suffix => { const value=account(suffix); return createHash('sha256').update(value.client_id+'\0'+value.subject).digest('hex').slice(0,16); };
const chosen = idFor('chosen'), other = idFor('other');
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'storychat-handoff-qa-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const vault = name => new Vault(join(directory, name, 'data'), join(directory, name, 'keys'));
  const source = vault('source'), target = vault('target');
  await source.locked(async () => { const data = await source.load(); data.accounts = { [chosen]: account('chosen'), [other]: account('other') }; await source.save(data); });
  await target.locked(async () => { const data = await target.load(); await target.save(data); });
  return { directory, source, target, vault, request: join(directory, 'request.json'), bundle: join(directory, 'bundle.json') };
}
const load = vault => vault.locked(() => vault.load());
const safeMetadata = value => assert.ok(!JSON.stringify(value).includes(marker), 'Public result must not expose synthetic credentials.');

test('QA handoff: recipient binding, authenticated ciphertext and replay ledger protect rotated destination credentials', async t => {
  const f = await fixture(t);
  const originalSource = await load(f.source), originalTarget = await load(f.target);
  safeMetadata(await prepareHandoff(f.target, f.request));
  const publicRequest = await readFile(f.request, 'utf8');
  assert.ok(!publicRequest.includes('PRIVATE KEY')); assert.ok(!publicRequest.includes(marker));
  safeMetadata(await exportHandoff(f.source, chosen, f.request, f.bundle));
  const serialized = await readFile(f.bundle, 'utf8');
  assert.ok(!serialized.includes(marker)); assert.ok(!serialized.includes('PRIVATE KEY'));
  const sourceAfter = await load(f.source);
  assert.equal(sourceAfter.hostId, originalSource.hostId);
  assert.equal(sourceAfter.accounts[other].refresh_token, originalSource.accounts[other].refresh_token);
  for (const field of ['access_token', 'refresh_token', 'id_token']) assert.ok(!sourceAfter.accounts[chosen][field]);
  assert.ok(!(await readFile(f.source.file)).includes(Buffer.from(marker)));

  const wrong = f.vault('wrong'); await prepareHandoff(wrong, join(f.directory, 'wrong-request.json'));
  await assert.rejects(importHandoff(wrong, f.bundle), error => /^handoff_/.test(error.code));
  assert.deepEqual((await load(wrong)).accounts, {});
  const tampered = JSON.parse(serialized);
  tampered.ciphertext = (tampered.ciphertext[0] === 'A' ? 'B' : 'A') + tampered.ciphertext.slice(1);
  const tamperedFile = join(f.directory, 'tampered.json'); await writeFile(tamperedFile, JSON.stringify(tampered));
  await assert.rejects(importHandoff(f.target, tamperedFile), error => /^handoff_/.test(error.code));
  assert.deepEqual((await load(f.target)).accounts, {});
  await f.target.locked(async () => { const data = await f.target.load(); data.accounts[chosen] = { ...account('chosen'), refresh_token: marker + '_PREEXISTING_NEWER' }; await f.target.save(data); });
  await assert.rejects(importHandoff(f.target, f.bundle), { code: 'handoff_active' });
  assert.equal((await load(f.target)).accounts[chosen].refresh_token, marker + '_PREEXISTING_NEWER');
  await f.target.locked(async () => { const data = await f.target.load(); delete data.accounts[chosen]; await f.target.save(data); });
  safeMetadata(await importHandoff(f.target, f.bundle));
  let destination = await load(f.target);
  assert.equal(destination.hostId, originalTarget.hostId);
  assert.equal(destination.accounts[chosen].refresh_token, originalSource.accounts[chosen].refresh_token);
  await f.target.locked(async () => { const data = await f.target.load(); data.accounts[chosen].refresh_token = marker + '_ROTATED_NEWER'; await f.target.save(data); });
  const restartedTarget = new Vault(f.target.directory, f.target.keyDirectory);
  assert.equal((await importHandoff(restartedTarget, f.bundle)).alreadyImported, true);
  destination = await load(restartedTarget);
  assert.equal(destination.accounts[chosen].refresh_token, marker + '_ROTATED_NEWER');
});

test('QA handoff: publication failure disables source once and retries the encrypted journal unchanged', async t => {
  const f = await fixture(t);
  await prepareHandoff(f.target, f.request);
  let attempted;
  await assert.rejects(exportHandoff(f.source, chosen, f.request, f.bundle, { writeOutput: async (_path, bundle) => { attempted = structuredClone(bundle); throw Error('SYNTHETIC unavailable output'); } }), error => error.code === 'handoff_output');
  const afterFailure = await load(f.source);
  assert.ok(!afterFailure.accounts[chosen].refresh_token);
  assert.ok(afterFailure.accounts[other].refresh_token);
  const journal = Object.values(afterFailure.handoff.exports)[0];
  assert.deepEqual(journal.bundle, attempted);
  const reopened = new Vault(f.source.directory, f.source.keyDirectory);
  safeMetadata(await exportHandoff(reopened, chosen, f.request, f.bundle));
  assert.deepEqual(JSON.parse(await readFile(f.bundle, 'utf8')), attempted);
  // Retrying publication after an already-created output must also be harmless.
  safeMetadata(await exportHandoff(reopened, chosen, f.request, f.bundle));
  assert.deepEqual(JSON.parse(await readFile(f.bundle, 'utf8')), attempted);
  safeMetadata(await importHandoff(f.target, f.bundle));
  assert.equal((await load(f.target)).accounts[chosen].refresh_token, account('chosen').refresh_token);
  // A later source sign-in is a new decision. The old journal must not claim it
  // disconnected that fresh session or republish stale transferable credentials.
  await f.source.locked(async () => { const data = await f.source.load(); data.accounts[chosen] = { ...account('chosen'), refresh_token: marker + '_REAUTHORIZED_SOURCE' }; await f.source.save(data); });
  const published = await readFile(f.bundle, 'utf8');
  await assert.rejects(exportHandoff(f.source, chosen, f.request, f.bundle), error => ['handoff_active', 'handoff_source_active'].includes(error.code));
  assert.equal((await load(f.source)).accounts[chosen].refresh_token, marker + '_REAUTHORIZED_SOURCE');
  assert.equal(await readFile(f.bundle, 'utf8'), published);
});

test('QA handoff: active runtime and expiry reject without changing destination state', async t => {
  const f = await fixture(t);
  await f.target.locked(() => assert.rejects(prepareHandoff(f.target, f.request), { code: 'runtime_locked' }));
  await prepareHandoff(f.target, f.request);
  await f.source.locked(() => assert.rejects(exportHandoff(f.source, chosen, f.request, f.bundle), { code: 'runtime_locked' }));
  await exportHandoff(f.source, chosen, f.request, f.bundle);
  await f.target.locked(() => assert.rejects(importHandoff(f.target, f.bundle), { code: 'runtime_locked' }));
  const before = await load(f.target);
  await assert.rejects(importHandoff(f.target, f.bundle, { now: Date.now() + 25 * 3600000 }), { code: 'handoff_expired' });
  assert.deepEqual(await load(f.target), before);
});
