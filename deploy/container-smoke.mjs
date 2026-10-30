// Explicit Linux Docker integration test. No real credentials or provider requests.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const run = randomUUID();
const prefix = `storychat-qa-${run.slice(0, 12)}`;
const label = `storychat.qa.run=${run}`;
const image = process.env.STORYCHAT_TEST_IMAGE || `storychat-smoke:${run}`;
const artifacts = process.env.STORYCHAT_SMOKE_ARTIFACT_DIR || join(tmpdir(), prefix);
const origin = 'https://storychat.example.test';
const password = `SYNTHETIC-QA-${run}`;
const containers = new Set(), volumes = new Set();
let stage = 'initialization';
mkdirSync(artifacts, { recursive: true });
function docker(args, { allowFailure = false, timeout = 180000 } = {}) {
  const result = spawnSync('docker', args, { encoding: 'utf8', timeout, maxBuffer: 4 * 1024 * 1024, windowsHide: true });
  if (!allowFailure && (result.error || result.status !== 0)) {
    throw new Error(`Docker failed during ${stage}: ${(result.stderr || result.error?.message || result.stdout || `exit ${result.status}`).replaceAll(password, '[synthetic password]')}`);
  }
  return result;
}
const step = message => { stage = message; console.log(`Container QA: ${message}`); };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function exec(container, code, args = []) {
  return docker(['exec', container, 'node', '--input-type=module', '-e', code, ...args]).stdout.trim();
}
function runContainer(name, extra = [], command = []) {
  containers.add(name);
  docker(['run', '-d', '--name', name, '--label', label, '--init', '--network', 'none', '--user', '1000:1000', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--tmpfs', '/tmp:rw,noexec,nosuid,size=16777216', ...extra, image, ...command]);
  return name;
}
function own(name, type) {
  // Containers expose labels under .Config; volumes use .Labels.
  if (type === 'container') return docker(['inspect', '--format', '{{ index .Config.Labels "storychat.qa.run" }}', name], { allowFailure: true }).stdout.trim() === run;
  return docker(['volume', 'inspect', '--format', '{{ index .Labels "storychat.qa.run" }}', name], { allowFailure: true }).stdout.trim() === run;
}
function removeContainer(name) {
  if (own(name, 'container')) docker(['rm', '-f', name]);
  containers.delete(name);
}
async function healthy(name) {
  for (let n = 0; n < 60; n++) {
    const state = docker(['inspect', '--format', '{{.State.Running}}', name], { allowFailure: true }).stdout.trim();
    if (state !== 'true') throw new Error('Container stopped before becoming healthy.');
    const result = docker(['exec', name, 'node', 'deploy/healthcheck.mjs'], { allowFailure: true, timeout: 10000 });
    if (result.status === 0) return;
    await pause(500);
  }
  throw new Error('Container health deadline exceeded.');
}
let cookie = '';
function request(name, path, method = 'GET', body, authenticated = true) {
  const result = JSON.parse(exec(name, `
    import http from 'node:http';
    const [path,method,payload,cookie,host]=process.argv.slice(1);
    const result=await new Promise((resolve,reject)=>{const request=http.request({hostname:'127.0.0.1',port:8787,path,method,headers:{Host:host,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},timeout:5000},response=>{let body='';response.on('data',chunk=>body+=chunk);response.on('error',reject);response.on('end',()=>{try{resolve({status:response.statusCode,cookie:response.headers['set-cookie']?.[0],body:JSON.parse(body)});}catch(error){reject(error);}});});request.on('error',reject);request.on('timeout',()=>request.destroy(new Error('Synthetic HTTP deadline')));request.end(payload||undefined);});
    console.log(JSON.stringify(result));
  `, [path, method, body === undefined ? '' : JSON.stringify(body), authenticated ? cookie : '', new URL(origin).host]));
  return result;
}
function login(name) {
  const result = request(name, '/api/login', 'POST', { password }, false);
  assert.equal(result.status, 200); cookie = result.cookie.split(';')[0];
  assert.match(result.cookie, /Secure/); assert.match(result.cookie, /HttpOnly/);
}
async function completed(name, storyId) {
  for (let n = 0; n < 40; n++) {
    const response = request(name, `/api/stories/${storyId}`);
    assert.equal(response.status, 200);
    if (response.body.generations.at(-1)?.status !== 'pending') return response.body;
    await pause(100);
  }
  throw new Error('Generation did not reach a terminal state.');
}
function snapshot(story) { return { controls: story.controls, memories: story.memories, threads: story.threads, relationship: story.relationship, thoughts: story.thoughts, revision: story.revision, summary: story.summary }; }

try {
  step('Docker Linux engine and image');
  const engine = JSON.parse(docker(['info', '--format', '{{json .}}']).stdout);
  assert.equal(engine.OSType, 'linux');
  if (!process.env.STORYCHAT_TEST_IMAGE) docker(['build', '--platform', 'linux/amd64', '-t', image, '.'], { timeout: 600000 });
  const metadata = JSON.parse(docker(['image', 'inspect', image]).stdout)[0];
  assert.equal(metadata.Os, 'linux'); assert.equal(metadata.Architecture, 'amd64');
  assert.match(metadata.Config.User, /^1000(?::1000)?$/);

  step('runtime-only image and non-root filesystem');
  const inspectName = runContainer(`${prefix}-inspect`, [], ['node', '--input-type=module', '-e', String.raw`
    import {readdirSync,statSync,writeFileSync} from 'node:fs';
    import assert from 'node:assert/strict';
    assert.equal(process.getuid(),1000);
    const forbidden=/(^|\/)(analysis|tests|data|secrets|\.git|node_modules)(\/|$)|screenshots|\.apk$|\.env|evaluate-live/i;
    const files=[];function walk(path){for(const name of readdirSync(path)){const target=path+'/'+name;assert.ok(!forbidden.test(target), 'Excluded file in image: '+target);if(statSync(target).isDirectory())walk(target);else files.push(target.slice(5));}}
    walk('/app');assert.deepEqual(files.sort(),['app/provider.mjs','app/server.mjs','app/store.mjs','deploy/healthcheck.mjs','prototype/auth.mjs','prototype/cli.mjs','prototype/errors.mjs','prototype/handoff.mjs','prototype/output.mjs','prototype/provider.mjs','prototype/runtime-lock.mjs','prototype/stream.mjs','prototype/vault.mjs','public/app.js','public/icon.svg','public/index.html','public/manifest.webmanifest','public/style.css'].sort());assert.throws(()=>writeFileSync('/app/qa-write','blocked'));
    for(const path of ['/var/lib/storychat/stories','/var/lib/storychat/provider','/var/lib/storychat/keys']){const s=statSync(path);assert.equal(s.uid,1000);assert.equal(s.mode&0o777,0o700);}
  `]);
  assert.equal(docker(['wait', inspectName]).stdout.trim(), '0');
  removeContainer(inspectName);

  const mounts = [];
  for (const [suffix, destination] of [['stories', 'stories'], ['provider', 'provider'], ['keys', 'keys']]) {
    const name = `${prefix}-${suffix}`; volumes.add(name);
    docker(['volume', 'create', '--label', label, name]);
    mounts.push('--mount', `type=volume,src=${name},dst=/var/lib/storychat/${destination}`);
  }
  const secretFixture = runContainer(`${prefix}-secret`, mounts, ['node', '--input-type=module', '-e', `
    import {writeFileSync} from 'node:fs';writeFileSync('/var/lib/storychat/keys/qa-owner-password',process.argv[1]+'\\n',{mode:0o600});
  `, password]);
  assert.equal(docker(['wait', secretFixture]).stdout.trim(), '0'); removeContainer(secretFixture);
  const environment = ['-e', 'STORYCHAT_PROVIDER=fake', '-e', 'STORYCHAT_PASSWORD_FILE=/var/lib/storychat/keys/qa-owner-password', '-e', 'STORYCHAT_HOST=0.0.0.0', '-e', `STORYCHAT_ORIGIN=${origin}`];
  let main = runContainer(`${prefix}-app`, [...mounts, ...environment]);
  step('owner authentication and fake narrative state');
  await healthy(main);
  assert.equal(request(main, '/api/library', 'GET', undefined, false).status, 401);
  login(main);
  const character = request(main, '/api/characters', 'POST', { name: 'Nera', definition: 'Original synthetic adult lighthouse keeper.', opening: 'Welcome to the shore.' });
  const persona = request(main, '/api/personas', 'POST', { name: 'Sol', definition: 'Original synthetic adult traveler.' });
  assert.equal(character.status, 201); assert.equal(persona.status, 201);
  const story = request(main, '/api/stories', 'POST', { characterId: character.body.id, personaId: persona.body.id, title: 'Container QA synthetic story' });
  assert.equal(story.status, 201);
  const path = `/api/stories/${story.body.id}`;
  const turn = request(main, path + '/turns', 'POST', { requestId: randomUUID(), text: 'My favorite color is violet. I promise to bring the map. Thank you.' });
  assert.equal(turn.status, 202); assert.equal(turn.body.generation.context, undefined);
  let current = await completed(main, story.body.id);
  assert.equal(current.generations.at(-1).status, 'completed');
  assert.match(current.messages.at(-1).text, /FAKE DEMO/);
  assert.equal(current.memories.length, 1); assert.equal(current.threads[0].status, 'pending');
  assert.ok(current.relationship.length && current.thoughts.length);
  assert.equal(request(main, path + '/memories/' + current.memories[0].id, 'PATCH', { text: 'Favorite color: amber.', pinned: true }).status, 200);
  assert.equal(request(main, path + '/controls', 'PATCH', { tone: 'Reserved', detail: 'rich', length: 'short' }).status, 200);
  current = request(main, path).body;
  const expected = snapshot(current);
  exec(main, `import {statSync} from 'node:fs';import assert from 'node:assert/strict';assert.equal(process.getuid(),1000);const s=statSync(process.env.STORYCHAT_DB);assert.equal(s.uid,1000);assert.equal(s.mode&0o077,0);`);

  step('graceful container restart and isolated runtime refusal');
  docker(['restart', '--time', '150', main]); await healthy(main);
  assert.equal(request(main, path).status, 401); login(main);
  assert.deepEqual(snapshot(request(main, path).body), expected);
  const parallel = runContainer(`${prefix}-parallel`, [...mounts, ...environment]);
  const parallelExit = docker(['wait', parallel], { timeout: 30000 }).stdout.trim();
  assert.notEqual(parallelExit, '0'); await healthy(main); removeContainer(parallel);

  step('SIGKILL recovery and interrupted generation recovery');
  docker(['kill', '--signal', 'KILL', main]);
  docker(['start', main]); await healthy(main); login(main);
  assert.deepEqual(snapshot(request(main, path).body), expected);
  docker(['stop', '--time', '150', main]);
  const fixtureName = runContainer(`${prefix}-pending`, mounts, ['node', '--input-type=module', '-e', `
    import {Store} from './app/store.mjs';const store=new Store(process.env.STORYCHAT_DB);
    store.beginTurn(process.argv[1],{requestId:'synthetic-interrupted',text:'Synthetic interrupted attempt.'});store.close();
  `, story.body.id]);
  assert.equal(docker(['wait', fixtureName]).stdout.trim(), '0'); removeContainer(fixtureName);
  docker(['start', main]); await healthy(main); login(main);
  current = request(main, path).body;
  assert.equal(current.generations.at(-1).status, 'interrupted');
  assert.deepEqual(snapshot(current), expected);

  step('replacement container preserves named-volume state');
  docker(['stop', '--time', '150', main]); removeContainer(main);
  main = runContainer(`${prefix}-replacement`, [...mounts, ...environment]);
  await healthy(main); login(main);
  assert.deepEqual(snapshot(request(main, path).body), expected);
  assert.equal(request(main, path).body.generations.at(-1).status, 'interrupted');

  step('synthetic encrypted vault lock exclusivity and SIGKILL recovery');
  const holding = runContainer(`${prefix}-vault-holder`, mounts, ['node', '--input-type=module', '-e', `
    import {Vault} from './prototype/vault.mjs';
    const vault=new Vault(process.env.STORYCHAT_DATA_DIR,process.env.STORYCHAT_KEY_DIR);
    await vault.locked(async()=>{const data=await vault.load();data.accounts.qa={access_token:'SYNTHETIC_ACCESS_ONLY',refresh_token:'SYNTHETIC_REFRESH_ONLY'};await vault.save(data);console.log('SYNTHETIC_VAULT_READY');await new Promise(()=>{});});
  `]);
  let ready = false;
  for (let n = 0; n < 40; n++) {
    if (docker(['logs', holding]).stdout.includes('SYNTHETIC_VAULT_READY')) { ready = true; break; }
    await pause(100);
  }
  assert.ok(ready, 'Synthetic vault did not become ready.');
  const blocked = runContainer(`${prefix}-vault-blocked`, mounts, ['node', '--input-type=module', '-e', `
    import {Vault} from './prototype/vault.mjs';const vault=new Vault(process.env.STORYCHAT_DATA_DIR,process.env.STORYCHAT_KEY_DIR);
    try{await vault.locked(async()=>{});process.exit(8);}catch(error){if(error.code!=='runtime_locked')throw error;}
  `]);
  assert.equal(docker(['wait', blocked], { timeout: 30000 }).stdout.trim(), '0'); removeContainer(blocked);
  docker(['kill', '--signal', 'KILL', holding]); removeContainer(holding);
  const recovered = runContainer(`${prefix}-vault-recovered`, mounts, ['node', '--input-type=module', '-e', `
    import {Vault} from './prototype/vault.mjs';import {readFileSync,statSync} from 'node:fs';import assert from 'node:assert/strict';
    const vault=new Vault(process.env.STORYCHAT_DATA_DIR,process.env.STORYCHAT_KEY_DIR);
    await vault.locked(async()=>{const data=await vault.load();assert.equal(data.accounts.qa.refresh_token,'SYNTHETIC_REFRESH_ONLY');assert.ok(!readFileSync(vault.file).includes(Buffer.from('SYNTHETIC_')));assert.equal(statSync(vault.keyFile).mode&0o777,0o600);data.accounts.qa.refresh_token='SYNTHETIC_ROTATED_ONLY';await vault.save(data);});
  `]);
  assert.equal(docker(['wait', recovered], { timeout: 30000 }).stdout.trim(), '0'); removeContainer(recovered);

  step('actual CLI encrypted handoff with synthetic source and persistent target');
  const handoff = runContainer(`${prefix}-handoff`, mounts, ['node', '--input-type=module', '-e', String.raw`
    import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';import {readFileSync,writeFileSync,existsSync} from 'node:fs';import {Vault} from './prototype/vault.mjs';
    const targetEnvironment={...process.env,STORYCHAT_DATA_DIR:'/var/lib/storychat/provider/qa-handoff-target',STORYCHAT_KEY_DIR:'/var/lib/storychat/keys/qa-handoff-target'};
    const sourceEnvironment={...process.env,STORYCHAT_DATA_DIR:'/tmp/qa-handoff-source',STORYCHAT_KEY_DIR:'/tmp/qa-handoff-source-key'};
    const target=new Vault(targetEnvironment.STORYCHAT_DATA_DIR,targetEnvironment.STORYCHAT_KEY_DIR),source=new Vault(sourceEnvironment.STORYCHAT_DATA_DIR,sourceEnvironment.STORYCHAT_KEY_DIR);
    const marker='SYNTHETIC_HANDOFF_TOKEN_ONLY';const account={client_id:'synthetic-handoff-client',subject:'synthetic-handoff-subject',issuer:'https://auth.openai.com',scopes:['chatgpt.tokens.use.direct'],expires_at:Date.now()+3600000,access_token:marker+'_ACCESS',refresh_token:marker+'_REFRESH',id_token:marker+'_ID'};
    // The NUL separator must match the existing onboarding identity convention.
    const realAccountId=createHash('sha256').update(account.client_id+String.fromCharCode(0)+account.subject).digest('hex').slice(0,16);
    function cli(environment,args,input){const output=execFileSync(process.execPath,['prototype/cli.mjs',...args],{env:environment,encoding:'utf8',...(input?{input}:{})});assert.ok(!output.includes(marker));assert.ok(!output.includes('PRIVATE KEY'));return JSON.parse(output);}
    await target.locked(async()=>{await target.save(await target.load());});
    const before=await target.locked(()=>target.load());
    await source.locked(async()=>{const data=await source.load();data.accounts[realAccountId]=account;await source.save(data);});
    const sourceBefore=await source.locked(()=>source.load());
    const request='/var/lib/storychat/provider/qa-handoff-request.json',bundle='/var/lib/storychat/provider/qa-handoff-bundle.json';
    const prepared=cli(targetEnvironment,['handoff-prepare',request]);assert.equal(prepared.targetHostId,before.hostId);
    const exported=cli(sourceEnvironment,['handoff-export',realAccountId,request,bundle]);assert.equal(exported.sourceDisconnected,true);
    const sourceAfter=await source.locked(()=>source.load());assert.equal(sourceAfter.hostId,sourceBefore.hostId);assert.ok(!sourceAfter.accounts[realAccountId].refresh_token);
    const publicData=readFileSync(request,'utf8')+readFileSync(bundle,'utf8');assert.ok(!publicData.includes(marker));assert.ok(!publicData.includes('PRIVATE KEY'));
    const imported=cli(targetEnvironment,['handoff-import','-'],readFileSync(bundle));assert.equal(imported.accountId,realAccountId);assert.equal(imported.alreadyImported,false);
    const status=cli(targetEnvironment,['accounts']);assert.equal(status[0].connected,true);
    await target.locked(async()=>{const data=await target.load();assert.equal(data.hostId,before.hostId);assert.equal(data.accounts[realAccountId].refresh_token,marker+'_REFRESH');data.accounts[realAccountId].refresh_token=marker+'_ROTATED';await target.save(data);});
    const replay=cli(targetEnvironment,['handoff-import',bundle]);assert.equal(replay.alreadyImported,true);
    assert.ok(!existsSync(target.keyDirectory+'/handoff-'+prepared.requestId+'.pem'));
    writeFileSync('/var/lib/storychat/provider/qa-handoff-check.json',JSON.stringify({hostId:before.hostId,accountId:realAccountId,requestId:prepared.requestId}),{mode:0o600});
  `]);
  assert.equal(docker(['wait', handoff], { timeout: 60000 }).stdout.trim(), '0'); removeContainer(handoff);
  assert.ok(!JSON.stringify(request(main, '/api/session').body).includes('handoff'));
  docker(['stop', '--time', '150', main]); removeContainer(main);
  main = runContainer(`${prefix}-handoff-replacement`, [...mounts, ...environment]);
  await healthy(main); login(main);
  assert.deepEqual(snapshot(request(main, path).body), expected);
  const persistedHandoff = runContainer(`${prefix}-handoff-persisted`, mounts, ['node', '--input-type=module', '-e', String.raw`
    import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {Vault} from './prototype/vault.mjs';
    const environment={...process.env,STORYCHAT_DATA_DIR:'/var/lib/storychat/provider/qa-handoff-target',STORYCHAT_KEY_DIR:'/var/lib/storychat/keys/qa-handoff-target'};
    const expected=JSON.parse(readFileSync('/var/lib/storychat/provider/qa-handoff-check.json','utf8'));
    const vault=new Vault(environment.STORYCHAT_DATA_DIR,environment.STORYCHAT_KEY_DIR);
    await vault.locked(async()=>{const data=await vault.load();assert.equal(data.hostId,expected.hostId);assert.equal(data.handoff.requests[expected.requestId].state,'consumed');assert.equal(data.accounts[expected.accountId].refresh_token,'SYNTHETIC_HANDOFF_TOKEN_ONLY_ROTATED');});
    const output=execFileSync(process.execPath,['prototype/cli.mjs','handoff-import','/var/lib/storychat/provider/qa-handoff-bundle.json'],{env:environment,encoding:'utf8'});assert.equal(JSON.parse(output).alreadyImported,true);assert.ok(!output.includes('SYNTHETIC_HANDOFF_TOKEN_ONLY'));
    await vault.locked(async()=>{assert.equal((await vault.load()).accounts[expected.accountId].refresh_token,'SYNTHETIC_HANDOFF_TOKEN_ONLY_ROTATED');});
  `]);
  assert.equal(docker(['wait', persistedHandoff], { timeout: 60000 }).stdout.trim(), '0'); removeContainer(persistedHandoff);
  console.log('Container QA passed: Linux amd64, non-root/read-only image, password file, auth, durable state, restart, SIGKILL, interruption, replacement, synthetic vault and encrypted CLI handoff. No live inference.');
  writeFileSync(join(artifacts, 'result.json'), JSON.stringify({ passed: true, image, platform: 'linux/amd64', liveInference: false, checks: ['image-boundaries', 'non-root', 'read-only', 'password-file', 'owner-auth', 'fake-state', 'correction-pin-controls', 'restart', 'parallel-refusal', 'SIGKILL', 'interrupted-recovery', 'replacement', 'synthetic-vault-exclusivity-and-recovery', 'encrypted-cli-handoff', 'handoff-replay-after-replacement'] }, null, 2));
} catch (error) {
  console.error(`Container QA failed during ${stage}: ${String(error.message).replaceAll(password, '[synthetic password]')}`);
  for (const name of containers) if (own(name, 'container')) {
    const logs = docker(['logs', '--tail', '150', name], { allowFailure: true });
    writeFileSync(join(artifacts, name + '.log'), (logs.stdout + logs.stderr).replaceAll(password, '[synthetic password]'));
  }
  writeFileSync(join(artifacts, 'result.json'), JSON.stringify({ passed: false, stage, image, liveInference: false }, null, 2));
  process.exitCode = 1;
} finally {
  // Only exact names created by this run AND carrying its random label may be removed.
  for (const name of containers) if (own(name, 'container')) docker(['rm', '-f', name], { allowFailure: true });
  for (const name of volumes) if (own(name, 'volume')) docker(['volume', 'rm', name], { allowFailure: true });
  console.log(`Container QA artifacts: ${artifacts}`);
}
