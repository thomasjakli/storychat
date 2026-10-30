import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('QA: SSH host launcher restricts mounts and restarts original app after success or failed consent', {skip:process.platform!=='linux'},async t=>{
  const directory=await mkdtemp(join(tmpdir(),'storychat-launcher-qa-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const log=join(directory,'calls.jsonl');
  await writeFile(join(directory,'docker'),`#!/usr/bin/env node
const fs=require('node:fs');const a=process.argv.slice(2);fs.appendFileSync(process.env.QA_LOG,JSON.stringify(a)+'\\n');
if(a[0]==='inspect'){const f=a[2];if(f.includes('State.Running'))console.log('true');else if(f.includes('.Image'))console.log('sha256:'+'a'.repeat(64));else if(f.includes('Config.Env'))console.log('');else if(f.includes('/provider'))console.log('qa-provider');else if(f.includes('/keys'))console.log('qa-keys');else console.log('');}
if(a[0]==='run')process.exit(Number(process.env.QA_RESULT));
`,{mode:0o700});
  const script=fileURLToPath(new URL('../../deploy/connect-chatgpt.sh',import.meta.url));
  for(const expected of [0,17]){
    await writeFile(log,'');
    const result=spawnSync('bash',[script,'synthetic-app','1455'],{env:{...process.env,PATH:directory+':'+process.env.PATH,QA_LOG:log,QA_RESULT:String(expected)},encoding:'utf8'});
    assert.equal(result.status,expected,result.stderr);
    const calls=(await readFile(log,'utf8')).trim().split('\n').map(JSON.parse),run=calls.find(a=>a[0]==='run');
    assert.ok(run.includes('--read-only'));assert.ok(run.includes('1000:1000'));assert.equal(run[run.indexOf('--network')+1],'host');
    const mounts=run.flatMap((v,i)=>v==='--mount'?[run[i+1]]:[]);
    assert.equal(mounts.length,2);assert.ok(mounts.every(v=>!v.includes('stories')&&!v.includes('docker.sock')));
    assert.ok(calls.some(a=>a[0]==='stop'&&a.at(-1)==='synthetic-app'));
    assert.ok(calls.some(a=>a[0]==='start'&&a[1]==='synthetic-app'));
    assert.ok(!calls.some(a=>a.includes('--privileged')||a.includes('--volumes-from')));
  }
});
