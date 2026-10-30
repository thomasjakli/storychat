import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { connectSsh, parseSshPort } from '../cli.mjs';
import { loadConnection, validateConnection } from '../connection.mjs';
import { signIn } from '../auth.mjs';

test('SSH ports reject malformed values before authorization', async () => {
  assert.equal(parseSshPort(),1455);
  for(const value of ['0','1023','65536','1455;bad',' 1455','1.455']) assert.throws(()=>parseSshPort(value));
  for(const port of [-1,1023,65536,'1455']) await assert.rejects(signIn('synthetic',null,()=>assert.fail(),undefined,{port}),{code:'invalid_callback_port'});
});

test('SSH connection persists only an explicitly chosen catalog model and preserves host identity', async t => {
  const directory=await mkdtemp(join(tmpdir(),'storychat-ssh-')); t.after(()=>rm(directory,{recursive:true,force:true}));
  const account={client_id:'synthetic-client',subject:'synthetic-owner',access_token:'SYNTHETIC_SECRET'};
  const id=createHash('sha256').update(account.client_id+'\0'+account.subject).digest('hex').slice(0,16);
  const data={version:1,hostId:'synthetic-stable-host',accounts:{}}; let locked=false,authCalls=0;
  const vault={directory,async locked(action){locked=true;try{return await action();}finally{locked=false;}},async load(){return data;},async save(value){assert.equal(value.hostId,data.hostId);}};
  const result=await connectSsh(vault,{authenticate:async(host,old,show,fetcher,options)=>{authCalls++;assert.equal(host,data.hostId);assert.equal(options.port,1455);assert.equal(locked,true);return account;},makeProvider:()=>({async listModels(){return [{slug:'first'},{slug:'second'}];}}),ask:async()=> '2',report:()=>{}});
  assert.equal(authCalls,1);assert.deepEqual(result,{version:1,accountId:id,model:'second'});
  assert.deepEqual(await loadConnection(directory),result);
  assert.ok(!(await readFile(join(directory,'connection.json'),'utf8')).includes('SYNTHETIC_SECRET'));
  assert.equal(locked,false);
});

test('connection selection rejects unknown fields and unsafe model identifiers',()=>{
  for(const value of [{version:1,accountId:'a'.repeat(16),model:'ok',token:'bad'},{version:1,accountId:'owner',model:'ok'},{version:1,accountId:'a'.repeat(16),model:'bad\nmodel'}]) assert.throws(()=>validateConnection(value));
});
