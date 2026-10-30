// Same-owner session move. Transfer requests and bundles over authenticated SSH.
// Recipient encryption protects tokens; it does not authenticate a substituted public request.
import { randomUUID, randomBytes, generateKeyPairSync, createPublicKey, createPrivateKey, publicEncrypt, privateDecrypt, createCipheriv, createDecipheriv, createHash, constants } from 'node:crypto';
import { readFile, writeFile, lstat, realpath, link, unlink, open } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { protectDirectory } from './vault.mjs';
import { ProviderError } from './errors.mjs';

const TTL = 24 * 60 * 60 * 1000;
const MAX_FILE = 256 * 1024;
const requestKeys = ['version', 'requestId', 'targetHostId', 'createdAt', 'expiresAt', 'publicKey'];
const headerKeys = ['version', 'requestId', 'targetHostId', 'createdAt', 'expiresAt'];
const bundleKeys = [...headerKeys, 'encryptedKey', 'iv', 'tag', 'ciphertext'];
const accountKeys = ['client_id', 'subject', 'issuer', 'email', 'access_token', 'refresh_token', 'id_token', 'scopes', 'expires_at', 'token_type'];
const secretKeys = ['access_token', 'refresh_token', 'id_token', 'scopes', 'expires_at'];
const fail = (code = 'invalid') => { throw new ProviderError('handoff_' + code, ({
  invalid: 'Invalid or unsupported handoff data. No credentials were imported.',
  expired: 'Handoff expired or has an invalid lifetime. Prepare a fresh destination request.',
  recipient: 'Handoff does not match this destination or its pending request.',
  active: 'Destination account already has credentials. Stop and revoke or clear that session before importing.',
  replay: 'This request was already consumed by a different bundle. Existing credentials were preserved.',
  output: 'Unsafe or unavailable output. Existing files were preserved. If export already moved the session, retry the same request and account to recover its encrypted bundle.',
  account: 'Selected account has no transferable session or its identity is invalid.',
  source_active: 'Source account was authorized again after this handoff. Existing credentials and recovery journal were preserved; do not republish the earlier session. Review and disconnect obsolete sessions in ChatGPT Settings before preparing a fresh handoff.'
})[code] ?? 'Handoff failed safely.'); };
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const accountIdFor = account => createHash('sha256').update(account.client_id + '\0' + account.subject).digest('hex').slice(0, 16);
const exact = (value, allowed, required = allowed) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.keys(value).every(key => allowed.includes(key)) || !required.every(key => Object.hasOwn(value, key))) fail();
};
const bounded = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max;
const samePath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
function validateHeader(value, now) {
  if (value.version !== 1 || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.requestId) || !bounded(value.targetHostId, 256)) fail();
  if (!Number.isSafeInteger(value.createdAt) || !Number.isSafeInteger(value.expiresAt) || value.createdAt <= 0 || value.createdAt > now + 60000 || value.expiresAt - value.createdAt !== TTL || value.expiresAt <= now) fail('expired');
}
function publicKey(pem) {
  try {
    if (!bounded(pem, 2000) || !pem.startsWith('-----BEGIN PUBLIC KEY-----')) fail();
    const key = createPublicKey(pem);
    if (key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails.modulusLength !== 3072 || key.asymmetricKeyDetails.publicExponent !== 65537n || key.export({ type: 'spki', format: 'pem' }).trim() !== pem.trim()) fail();
    return key;
  } catch { fail(); }
}
function requestData(value, now) { exact(value, requestKeys); validateHeader(value, now); publicKey(value.publicKey); return value; }
function header(value) { return Object.fromEntries(headerKeys.map(key => [key, value[key]])); }
function bytes(value, length, max = MAX_FILE) {
  if (!bounded(value, Math.ceil(max * 4 / 3) + 4) || !/^[A-Za-z0-9_-]+$/.test(value)) fail();
  const data = Buffer.from(value, 'base64url');
  if (data.toString('base64url') !== value || (length !== undefined && data.length !== length) || data.length > max) fail();
  return data;
}
function bundleData(value, now) {
  exact(value, bundleKeys); validateHeader(value, now);
  bytes(value.encryptedKey, 384); bytes(value.iv, 12); bytes(value.tag, 16); bytes(value.ciphertext, undefined, 65536);
  return value;
}
function credentialData(account, id) {
  exact(account, accountKeys, ['client_id', 'subject', 'issuer', 'access_token', 'refresh_token', 'scopes', 'expires_at']);
  if (!bounded(account.client_id, 256) || account.client_id === 'dynamic_agent_client' || !bounded(account.subject, 256) || account.issuer !== 'https://auth.openai.com' ||
    !bounded(account.access_token, 16000) || !bounded(account.refresh_token, 16000) || (account.id_token !== undefined && !bounded(account.id_token, 16000)) ||
    (account.email !== undefined && !bounded(account.email, 320)) || (account.token_type !== undefined && account.token_type !== 'Bearer') || !Number.isSafeInteger(account.expires_at) || account.expires_at <= 0 ||
    !Array.isArray(account.scopes) || account.scopes.length > 32 || !account.scopes.every(scope => bounded(scope, 128)) || !account.scopes.includes('chatgpt.tokens.use.direct') || id !== accountIdFor(account)) fail('account');
  return account;
}
async function inputFile(path) {
  let data;
  try {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_FILE) fail();
    data = await readFile(path);
  } catch (error) { if (error instanceof ProviderError) throw error; fail(); }
  if (data.length > MAX_FILE) fail();
  try { return JSON.parse(data.toString('utf8')); } catch { fail(); }
}
async function bundleInput(path) {
  if (path !== '-') return inputFile(path);
  const parts = []; let total = 0;
  for await (const chunk of process.stdin) { total += chunk.length; if (total > MAX_FILE) fail(); parts.push(chunk); }
  try { return JSON.parse(Buffer.concat(parts).toString('utf8')); } catch { fail(); }
}
async function safeOutput(vault, output) {
  if (!bounded(output, 4096) || output === '-') fail('output');
  const path = resolve(output), parent = dirname(path);
  const protectedFiles = [vault.file, vault.keyFile, join(vault.directory, '.lock')].filter(Boolean).map(value => resolve(value));
  if ((samePath(dirname(path), resolve(vault.keyDirectory)) && /^handoff-.*\.pem$/i.test(path.slice(dirname(path).length + 1))) || protectedFiles.some(value => samePath(path, value))) fail('output');
  try {
    if (!samePath(await realpath(parent), parent)) fail('output');
    const stat = await lstat(path).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (stat && (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_FILE)) fail('output');
  } catch (error) { if (error instanceof ProviderError) throw error; fail('output'); }
  return path;
}
async function publish(path, value) {
  const text = JSON.stringify(value, null, 2) + '\n';
  try {
    const existing = await lstat(path).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (existing) {
      if (!existing.isFile() || existing.isSymbolicLink() || existing.size > MAX_FILE || (await readFile(path, 'utf8')) !== text) fail('output');
      return;
    }
    const temp = join(dirname(path), '.handoff-' + randomUUID() + '.tmp');
    try {
      const file = await open(temp, 'wx', 0o600);
      try { await file.writeFile(text); await file.sync(); } finally { await file.close(); }
      // Hard-link publication is atomic and refuses an existing destination; never overwrite.
      await link(temp, path);
    } finally { await unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  } catch (error) { if (error instanceof ProviderError) throw error; fail('output'); }
}
function ledger(data) {
  data.handoff ??= { requests: {}, exports: {} };
  if (!data.handoff.requests || !data.handoff.exports || Object.keys(data.handoff.requests).length > 128 || Object.keys(data.handoff.exports).length > 128) fail();
  return data.handoff;
}
function keyPath(vault, requestId) { return join(vault.keyDirectory, 'handoff-' + requestId + '.pem'); }
async function recipientKey(vault, request) {
  try {
    const path = keyPath(vault, request.requestId), stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8192 || (process.platform !== 'win32' && (stat.mode & 0o077))) fail('recipient');
    const key = createPrivateKey(await readFile(path, 'utf8'));
    if (key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails.modulusLength !== 3072 || createPublicKey(key).export({ type: 'spki', format: 'pem' }) !== request.publicKey) fail('recipient');
    return key;
  } catch { fail('recipient'); }
}

export async function prepareHandoff(vault, requestOutput, { now = Date.now() } = {}) {
  return vault.locked(async () => {
    const output = await safeOutput(vault, requestOutput);
    const data = await vault.load(), state = ledger(data);
    let pending = Object.values(state.requests).find(entry => entry.state === 'pending' && entry.request.expiresAt > now);
    if (!pending) {
      if (Object.keys(state.requests).length >= 128) fail();
      const requestId = randomUUID();
      const keys = generateKeyPairSync('rsa', { modulusLength: 3072, publicExponent: 65537,
        publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
      const request = { version: 1, requestId, targetHostId: data.hostId, createdAt: now, expiresAt: now + TTL, publicKey: keys.publicKey };
      requestData(request, now);
      await protectDirectory(vault.keyDirectory);
      await writeFile(keyPath(vault, requestId), keys.privateKey, { flag: 'wx', mode: 0o600 });
      pending = { request, state: 'pending' }; state.requests[requestId] = pending;
      // A crash before this save leaves an unused orphan key, never an authorized import request.
      await vault.save(data);
    }
    if (pending.request.targetHostId !== data.hostId) fail('recipient');
    // Never republish a request whose protected recipient key was lost or replaced.
    await recipientKey(vault, pending.request);
    await publish(output, pending.request);
    return { requestId: pending.request.requestId, targetHostId: data.hostId, expiresAt: pending.request.expiresAt };
  });
}

export async function exportHandoff(vault, accountId, requestFile, bundleOutput, { now = Date.now(), writeOutput = publish } = {}) {
  return vault.locked(async () => {
    const request = requestData(await inputFile(requestFile), now);
    const output = await safeOutput(vault, bundleOutput);
    const data = await vault.load(), state = ledger(data);
    if (request.targetHostId === data.hostId) fail('recipient');
    const requestHash = hash(request);
    let journal = state.exports[request.requestId];
    if (journal) {
      if (journal.accountId !== accountId || journal.requestHash !== requestHash) fail('recipient');
      // Reauthorization creates a new renewable session. Never report it disconnected
      // or republish the old session while the selected source record is active again.
      if (data.accounts[accountId] && secretKeys.some(field => Object.hasOwn(data.accounts[accountId], field))) fail('source_active');
    } else {
      if (Object.keys(state.exports).length >= 128) fail();
      const account = credentialData(data.accounts[accountId], accountId);
      const key = randomBytes(32), iv = randomBytes(12), h = header(request);
      const cipher = createCipheriv('aes-256-gcm', key, iv); cipher.setAAD(Buffer.from(JSON.stringify(h)));
      const ciphertext = Buffer.concat([cipher.update(JSON.stringify({ version: 1, accountId, account }), 'utf8'), cipher.final()]);
      const bundle = { ...h, encryptedKey: publicEncrypt({ key: publicKey(request.publicKey), padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, key).toString('base64url'),
        iv: iv.toString('base64url'), tag: cipher.getAuthTag().toString('base64url'), ciphertext: ciphertext.toString('base64url') };
      // Refuse a pre-existing different file before moving the renewable session.
      try { const existing = await readFile(output, 'utf8'); if (existing !== JSON.stringify(bundle, null, 2) + '\n') fail('output'); }
      catch (error) { if (error.code !== 'ENOENT') { if (error instanceof ProviderError) throw error; fail('output'); } }
      journal = { accountId, requestHash, bundle }; state.exports[request.requestId] = journal;
      const mapping = { ...account }; for (const field of secretKeys) delete mapping[field];
      data.accounts[accountId] = mapping;
      // One encrypted vault transaction persists recovery ciphertext AND disables desktop refresh.
      await vault.save(data);
    }
    try { await writeOutput(output, journal.bundle); } catch (error) { if (error instanceof ProviderError) throw error; fail('output'); }
    return { requestId: request.requestId, targetHostId: request.targetHostId, expiresAt: request.expiresAt, sourceDisconnected: true };
  });
}

export async function importHandoff(vault, bundleFile, { now = Date.now() } = {}) {
  return vault.locked(async () => {
    const bundle = bundleData(await bundleInput(bundleFile), now);
    const data = await vault.load(), state = ledger(data), entry = state.requests[bundle.requestId];
    if (bundle.targetHostId !== data.hostId || !entry || hash(header(bundle)) !== hash(header(entry.request))) fail('recipient');
    const bundleHash = hash(bundle);
    if (entry.state === 'consumed') {
      if (entry.bundleHash !== bundleHash) fail('replay');
      return { accountId: entry.accountId, requestId: bundle.requestId, alreadyImported: true };
    }
    if (entry.state !== 'pending') fail('recipient');
    let payload;
    try {
      const keyObject = await recipientKey(vault, entry.request);
      const key = privateDecrypt({ key: keyObject, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, bytes(bundle.encryptedKey, 384));
      if (key.length !== 32) fail();
      const decipher = createDecipheriv('aes-256-gcm', key, bytes(bundle.iv, 12));
      decipher.setAAD(Buffer.from(JSON.stringify(header(bundle)))); decipher.setAuthTag(bytes(bundle.tag, 16));
      payload = JSON.parse(Buffer.concat([decipher.update(bytes(bundle.ciphertext, undefined, 65536)), decipher.final()]).toString('utf8'));
    } catch { fail('recipient'); }
    exact(payload, ['version', 'accountId', 'account']);
    if (payload.version !== 1 || !/^[0-9a-f]{16}$/.test(payload.accountId)) fail();
    credentialData(payload.account, payload.accountId);
    const existing = data.accounts[payload.accountId];
    if (existing && secretKeys.some(field => Object.hasOwn(existing, field))) fail('active');
    data.accounts[payload.accountId] = payload.account;
    Object.assign(entry, { state: 'consumed', bundleHash, accountId: payload.accountId });
    await vault.save(data); // Durable replay ledger and credentials committed together, before key deletion.
    await unlink(keyPath(vault, bundle.requestId)).catch(() => {});
    return { accountId: payload.accountId, requestId: bundle.requestId, alreadyImported: false };
  });
}
