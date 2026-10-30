import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Vault } from './vault.mjs';
import { signIn } from './auth.mjs';
import { ChatGPTProvider, FakeProvider } from './provider.mjs';
import { ProviderError } from './errors.mjs';
import { prepareHandoff, exportHandoff, importHandoff } from './handoff.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const [command, accountId, model, bundleOutput] = process.argv.slice(2);
const help = `Storychat subscription-only feasibility CLI
  node prototype/cli.mjs init
  node prototype/cli.mjs auth [saved-account-id]
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
async function main() {
  if (!command || command === 'help') { console.log(help); return; }
  if (command === 'fake') {
    const result = await new FakeProvider(accountId).generate();
    console.log('DETERMINISTIC FAKE; no network or subscription used.'); console.log(JSON.stringify(result, null, 2)); return;
  }
  if (!['init', 'auth', 'accounts', 'models', 'probe', 'refresh', 'revoke', 'handoff-prepare', 'handoff-export', 'handoff-import'].includes(command)) throw new Error('Unknown command. Use help.');
  const vault = new Vault(process.env.STORYCHAT_DATA_DIR ?? resolve(root, 'data/provider-spike'), process.env.STORYCHAT_KEY_DIR ?? resolve(root, 'secrets/provider-spike'));
  if (command === 'handoff-prepare') { console.log(JSON.stringify(await prepareHandoff(vault, accountId))); return; }
  if (command === 'handoff-export') { console.log(JSON.stringify(await exportHandoff(vault, accountId, model, bundleOutput))); return; }
  if (command === 'handoff-import') { console.log(JSON.stringify(await importHandoff(vault, accountId))); return; }
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
main().catch(error => {
  // Never print response bodies, request headers, token objects, or arbitrary network exceptions.
  console.error(error instanceof ProviderError ? `${error.code}: ${error.message}` : 'Operation failed. Check command arguments, protected runtime paths and permissions. No paid fallback was used.');
  process.exitCode = 1;
});
