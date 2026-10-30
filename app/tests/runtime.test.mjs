import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, stat, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { acquireRuntimeLock } from '../../prototype/runtime-lock.mjs';
import { createApplication, readOwnerPassword } from '../server.mjs';
import { Store } from '../store.mjs';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function directory(t) { const path=await mkdtemp(join(tmpdir(),'storychat-runtime-')); t.after(()=>rm(path,{recursive:true,force:true})); return path; }
const blank = {reply:'Synthetic reply.',memories:[],threads:[],relationship:[],thoughts:[],scene:null};

test('runtime lock refuses concurrent ownership and releases on success without unlinking Linux inode', async t=>{
  const path=join(await directory(t),'.lock');
  const first=await acquireRuntimeLock(path);
  const before=await stat(path);
  await assert.rejects(acquireRuntimeLock(path),{code:'runtime_locked'});
  await first.release(); await first.release();
  if(process.platform==='linux') assert.equal((await stat(path)).ino,before.ino);
  else await assert.rejects(access(path),{code:'ENOENT'});
  const second=await acquireRuntimeLock(path); await second.release();
});

test('owner password file is bounded UTF-8, preserves spaces and rejects ambiguous configuration', async t=>{
  const path=join(await directory(t),'password');
  await writeFile(path,'  synthetic password  \r\n');
  assert.equal(await readOwnerPassword({STORYCHAT_PASSWORD_FILE:path}),'  synthetic password  ');
  await assert.rejects(readOwnerPassword({STORYCHAT_PASSWORD:'synthetic password',STORYCHAT_PASSWORD_FILE:path}),{code:'startup_configuration'});
  await writeFile(path,Buffer.from([0xff,0xfe])); await assert.rejects(readOwnerPassword({STORYCHAT_PASSWORD_FILE:path}),{code:'startup_configuration'});
  await writeFile(path,'x'.repeat(1025)); await assert.rejects(readOwnerPassword({STORYCHAT_PASSWORD_FILE:path}),{code:'startup_configuration'});
  await writeFile(path,'too short'); await assert.rejects(readOwnerPassword({STORYCHAT_PASSWORD_FILE:path}),{code:'startup_configuration'});
  await assert.rejects(readOwnerPassword({STORYCHAT_PASSWORD_FILE:path+'missing'}),{code:'startup_configuration'});
});

async function ready(child) {
  let output='';
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{child.kill();reject(new Error('Synthetic child readiness timeout.'));},10000);
    child.stdout.on('data',chunk=>{output+=chunk;if(output.includes('READY')||output.includes('Storychat:')){clearTimeout(timer);resolve(output);}});
    child.once('error',error=>{clearTimeout(timer);reject(error);});
    child.once('exit',code=>{clearTimeout(timer);reject(new Error('Synthetic child exited before readiness: '+code));});
  });
}

test('Linux SIGKILL releases helper-held lock and preserves persistent lock inode', {skip:process.platform!=='linux'}, async t=>{
  const path=join(await directory(t),'.lock');
  const child=spawn(process.execPath,['--input-type=module','-e',`import { acquireRuntimeLock } from ${JSON.stringify(new URL('../../prototype/runtime-lock.mjs',import.meta.url).href)}; await acquireRuntimeLock(process.argv[1]); console.log('READY'); setInterval(()=>{},1000);`,path],{stdio:['ignore','pipe','pipe']});
  t.after(()=>child.kill('SIGKILL'));
  await ready(child); const inode=(await stat(path)).ino;
  await assert.rejects(acquireRuntimeLock(path),{code:'runtime_locked'});
  const exited=once(child,'exit'); child.kill('SIGKILL'); await exited;
  let recovered;
  for(let index=0;index<100;index++) {try{recovered=await acquireRuntimeLock(path);break;}catch(error){if(error.code!=='runtime_locked')throw error;await delay(20);}}
  assert.ok(recovered,'Kernel lock must recover without deleting its inode.');
  assert.equal((await stat(path)).ino,inode); await recovered.release();
});

test('Linux SIGTERM drains a real server and allows immediate same-database restart', {skip:process.platform!=='linux',timeout:40000}, async t=>{
  const db=join(await directory(t),'stories','story.sqlite');
  const serverPath=fileURLToPath(new URL('../server.mjs',import.meta.url));
  const wrapper=`import assert from 'node:assert/strict'; import {pathToFileURL} from 'node:url';
    const original=console.log; console.log=(...args)=>{
      if(String(args[0]).startsWith('Storychat:')){
        assert.ok(process.listenerCount('SIGTERM')>0,'Readiness must follow SIGTERM handler installation.');
        assert.ok(process.listenerCount('SIGINT')>0,'Readiness must follow SIGINT handler installation.');
      } original(...args);
    }; process.argv[1]=${JSON.stringify(serverPath)}; await import(pathToFileURL(process.argv[1]).href);`;
  for(let attempt=0;attempt<3;attempt++) {
    const child=spawn(process.execPath,['--input-type=module','-e',wrapper],{env:{...process.env,STORYCHAT_PASSWORD:'synthetic-process-password',STORYCHAT_PASSWORD_FILE:'',STORYCHAT_PROVIDER:'fake',STORYCHAT_DB:db,STORYCHAT_HOST:'127.0.0.1',STORYCHAT_ORIGIN:'',PORT:'0'},stdio:['ignore','pipe','pipe']});
    t.after(()=>child.kill('SIGKILL')); await ready(child);
    const exited=once(child,'exit');
    const deadline=setTimeout(()=>child.kill('SIGKILL'),5000);
    child.kill('SIGTERM');
    let result; try{result=await exited;}finally{clearTimeout(deadline);}
    const [code,signal]=result;
    assert.equal(signal,null,`Startup ${attempt+1} must handle SIGTERM instead of terminating by signal.`);
    assert.equal(code,0,`Startup ${attempt+1} must shut down cleanly.`);
    assert.equal((await stat(db)).mode&0o077,0);
    const lock=await acquireRuntimeLock(db+'.lock'); await lock.release();
  }
});

async function pendingApplication(t,shutdownTimeoutMs) {
  const store=new Store(':memory:'); let release,closed=false;
  const gate=new Promise(resolve=>{release=resolve;});
  const provider={name:'fake',model:'synthetic',async generate(){await gate;return blank;},async close(){closed=true;}};
  const app=createApplication({store,provider,password:'synthetic-runtime-password',shutdownTimeoutMs});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${app.server.address().port}`;
  const login=await fetch(origin+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'synthetic-runtime-password'})});
  const cookie=login.headers.get('set-cookie').split(';')[0]; await login.json();
  const character=store.createCharacter({name:'Nera',definition:'Synthetic adult keeper.'}),persona=store.createPersona({name:'Sol',definition:'Synthetic adult visitor.'});
  const story=store.createStory({characterId:character.id,personaId:persona.id,title:'Shutdown test'});
  const response=await fetch(origin+`/api/stories/${story.id}/turns`,{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify({requestId:'pending',text:'Continue.'})});
  assert.equal(response.status,202); await response.json();
  return {app,store,story,release,closed:()=>closed,origin};
}

test('shutdown stops accepting before draining and commits existing generation before cleanup', async t=>{
  const f=await pendingApplication(t,2000); const closing=f.app.close();
  assert.equal(f.app.close(),closing);
  await delay(20); assert.equal(f.closed(),false); assert.equal(f.store.getStory(f.story.id).generations[0].status,'pending');
  try { const response=await fetch(f.origin+'/health'); assert.equal(response.status,503); await response.arrayBuffer(); } catch(error) { assert.equal(error.name,'TypeError'); }
  let final; const original=f.store.close.bind(f.store); f.store.close=()=>{final=f.store.getStory(f.story.id);original();};
  f.release(); await closing; assert.equal(f.closed(),true); assert.equal(final.generations[0].status,'completed');
});

test('shutdown has a finite deadline and does not close state beneath unfinished provider work', async t=>{
  const f=await pendingApplication(t,50);
  await assert.rejects(f.app.close(),{code:'shutdown_timeout'});
  assert.equal(f.closed(),false); assert.equal(f.store.getStory(f.story.id).generations[0].status,'pending');
  f.release(); for(let index=0;index<100&&!f.closed();index++)await delay(10);
  assert.equal(f.closed(),true);
});
