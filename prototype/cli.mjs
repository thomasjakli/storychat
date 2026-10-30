import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Vault } from './vault.mjs';
import { signIn } from './auth.mjs';
import { ChatGPTProvider, FakeProvider } from './provider.mjs';
import { ProviderError } from './errors.mjs';
import { prepareHandoff, exportHandoff, importHandoff } from './handoff.mjs';
import { loadConnection, saveConnection } from './connection.mjs';
import { createInterface } from 'node:readline/promises';
const root = fileURLToPath(new URL('../', import.meta.url));
const [command, accountId, model, bundleOutput] = process.argv.slice(2);
const help = `Storychat subscription-only feasibility CLI
  node prototype/cli.mjs init
  node prototype/cli.mjs auth [saved-account-id]
  node prototype/cli.mjs connect-ssh [saved-account-id|new]
  node prototype/cli.mjs accounts
  node prototype/cli.mjs models <account-id>
  node prototype/cli.mjs probe <account-id> <model-slug>
  node prototype/cli.mjs refresh <account-id>
  node prototype/cli.mjs revoke <account-id>
  node prototype/cli.mjs handoff-prepare <request-output>
  node prototype/cli.mjs handoff-export <account-id> <request-file> <bundle-output>
  node prototype/cli.mjs handoff-import <bundle-file|->
  node prototype/cli.mjs fake [success|denied|interrupted|invalid]
No API-key route or paid fallback. Probe sends one synthetic request using your ChatGPT plan.
Manage usage: https://chatgpt.com/#settings/Usage`;
export function parseSshPort(value = '1455') {
  if (typeof value !== 'string' || !/^[0-9]{4,5}$/.test(value)) throw new ProviderError('invalid_callback_port', 'STORYCHAT_CALLBACK_PORT must be an integer from 1024 to 65535.');
  const port = Number(value);
  if (port < 1024 || port > 65535) throw new ProviderError('invalid_callback_port', 'STORYCHAT_CALLBACK_PORT must be an integer from 1024 to 65535.');
  return port;
}
export async function connectSsh(vault, { accountId: requested, port = 1455, authenticate = signIn,
  makeProvider = (account, persist) => new ChatGPTProvider(account, persist), ask, showUrl = url => console.log(url), report = message => console.log(message) } = {}) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new ProviderError('invalid_callback_port', 'SSH sign-in requires an explicit port from 1024 to 65535.');
  if (typeof ask !== 'function') throw new ProviderError('model_choice_required', 'Interactive model selection is required; no request was made.');
  return vault.locked(async () => {
    const data = await vault.load(); await vault.save(data);
    // A corrupt selection must not cause silent account changes or overwrite credentials.
    const saved = await loadConnection(vault.directory);
    const ids = Object.keys(data.accounts);
    let selected;
    if (requested === 'new') selected = undefined;
    else if (requested) {
      if (!data.accounts[requested]) throw new ProviderError('account_unknown', 'Choose a saved account ID from accounts, or specify new.');
      selected = requested;
    } else if (saved && data.accounts[saved.accountId]) selected = saved.accountId;
    else if (ids.length === 1) selected = ids[0];
    else if (ids.length > 1) throw new ProviderError('account_choice_required', 'More than one account is saved. Specify an account ID from accounts or new.');
    report(`Continue with ChatGPT using the SSH-forwarded callback on 127.0.0.1:${port}. Open the link in your local browser.`);
    const account = await authenticate(data.hostId, data.accounts[selected], showUrl, undefined, { port });
    const id = createHash('sha256').update(account.client_id + '\0' + account.subject).digest('hex').slice(0, 16);
    data.accounts[id] = account; await vault.save(data);
    const provider = makeProvider(account, async replacement => { data.accounts[id] = replacement; await vault.save(data); });
    const catalog = await provider.listModels();
    if (!Array.isArray(catalog) || !catalog.length) throw new ProviderError('model_unavailable', 'No models are available for this account. Sign-in was saved; no inference was made.');
    const models = catalog.filter(item => typeof item.slug === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(item.slug));
    if (!models.length) throw new ProviderError('model_unavailable', 'No supported model identifiers were returned. No inference was made.');
    let preferred = models.findIndex(item => saved?.accountId === id && saved.model === item.slug);
    if (preferred < 0) preferred = models.findIndex(item => item.slug === 'gpt-6.1-sol');
    if (preferred < 0) preferred = 0;
    report('Available models (using your ChatGPT plan):');
    models.forEach((item, index) => report(`${index + 1}. ${String(item.display_name ?? item.slug).replace(/[\x00-\x1f\x7f]/g, '').slice(0, 150)} (${item.slug})`));
    let choice;
    for (let attempt = 0; attempt < 3; attempt++) {
      const answer = await ask(`Choose a model [${preferred + 1}]: `);
      if (typeof answer === 'string' && answer.trim() === '') { choice = preferred; break; }
      if (typeof answer === 'string' && /^[1-9][0-9]*$/.test(answer.trim())) {
        const number = Number(answer.trim());
        if (number <= models.length) { choice = number - 1; break; }
      }
      report('Enter a listed number, or press Enter to accept the displayed default.');
    }
    if (choice === undefined) throw new ProviderError('model_choice_required', 'No valid model was selected. Sign-in remains saved; no inference was made.');
    const connection = await saveConnection(vault.directory, { version: 1, accountId: id, model: models[choice].slug });
    report('ChatGPT connection and model selection saved on this host. No inference request was made.');
    return connection;
  });
}
async function main() {
  if (!command || command === 'help') { console.log(help); return; }
  if (command === 'fake') {
    const result = await new FakeProvider(accountId).generate();
    console.log('DETERMINISTIC FAKE; no network or subscription used.'); console.log(JSON.stringify(result, null, 2)); return;
  }
  if (!['init', 'auth', 'connect-ssh', 'accounts', 'models', 'probe', 'refresh', 'revoke', 'handoff-prepare', 'handoff-export', 'handoff-import'].includes(command)) throw new Error('Unknown command. Use help.');
  const vault = new Vault(process.env.STORYCHAT_DATA_DIR ?? resolve(root, 'data/provider-spike'), process.env.STORYCHAT_KEY_DIR ?? resolve(root, 'secrets/provider-spike'));
  if (command === 'handoff-prepare') { console.log(JSON.stringify(await prepareHandoff(vault, accountId))); return; }
  if (command === 'handoff-export') { console.log(JSON.stringify(await exportHandoff(vault, accountId, model, bundleOutput))); return; }
  if (command === 'handoff-import') { console.log(JSON.stringify(await importHandoff(vault, accountId))); return; }
  if (command === 'connect-ssh') {
    const port = parseSshPort(process.env.STORYCHAT_CALLBACK_PORT);
    const terminal = createInterface({ input: process.stdin, output: process.stdout });
    try { await connectSsh(vault, { accountId, port, ask: question => terminal.question(question) }); }
    finally { terminal.close(); }
    return;
  }
  await vault.locked(async () => {
    const data = await vault.load(); await vault.save(data); // Persist host identity before first authorization.
    if (command === 'init') { console.log('Protected runtime initialized; no account authorized.'); return; }
    if (command === 'accounts') {
      console.log(JSON.stringify(Object.entries(data.accounts).map(([id, a]) => ({ id, email: a.email, connected: !!a.refresh_token })), null, 2)); return;
    }
    if (command === 'auth') {
      if (accountId && !data.accounts[accountId]) throw new Error('Unknown saved account.');
      console.log('Continue with ChatGPT. Open the following authorization link in a browser on THIS computer.');
      const account = await signIn(data.hostId, data.accounts[accountId], url => console.log(url));
      const id = createHash('sha256').update(account.client_id + '\0' + account.subject).digest('hex').slice(0, 16);
      data.accounts[id] = account; await vault.save(data);
      console.log('Connected account ' + id + '. No inference request has been made.'); return;
    }
    if (!accountId || !data.accounts[accountId]) throw new Error('Choose a saved account ID with accounts.');
    const provider = new ChatGPTProvider(data.accounts[accountId], async account => { data.accounts[accountId] = account; await vault.save(data); });
    if (command === 'models') console.log(JSON.stringify(await provider.listModels(), null, 2));
    if (command === 'refresh') { await provider.refresh(true); console.log('Renewed and atomically saved selected session.'); }
    if (command === 'revoke') console.log((await provider.revoke()).message);
    if (command === 'probe') {
      if (!model) throw new Error('Pass a model slug from models.');
      console.log('Using ChatGPT plan for one synthetic request; provisional deltas are withheld until validation.');
      const result = await provider.generate({ model, input: [{ role: 'user', content: 'Message ID probe-user-1: I promise to bring the map tomorrow. Reply briefly and record that intention with source probe-user-1.' }], sourceIds: ['probe-user-1'] });
      console.log(JSON.stringify(result, null, 2));
      console.log('Completed and validated. No story state was persisted.');
    }
  });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main().catch(error => {
  // Never print response bodies, request headers, token objects, or arbitrary network exceptions.
  console.error(error instanceof ProviderError ? `${error.code}: ${error.message}` : 'Operation failed. Check command arguments, protected runtime paths and permissions. No paid fallback was used.');
  process.exitCode = 1;
});
