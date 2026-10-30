import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProvider } from '../provider.mjs';

const id='0123456789abcdef';
async function fixture(t) {
  const directory=await mkdtemp(join(tmpdir(),'storychat-selection-qa-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  await writeFile(join(directory,'connection.json'),JSON.stringify({version:1,accountId:id,model:'selected'}));
  let requests=0,releases=0;
  const vault={async locked(action){try{return await action();}finally{releases++;}},async load(){return {accounts:{[id]:{client_id:'synthetic',subject:'synthetic',access_token:'SYNTHETIC',refresh_token:'SYNTHETIC',scopes:['chatgpt.tokens.use.direct'],expires_at:Date.now()+3600000}}};}};
  const fetcher=async url=>{requests++;assert.ok(url.endsWith('/models'),'Setup must never infer');return Response.json({models:[{slug:'selected',display_name:'Synthetic',visibility:'list'}]});};
  return {directory,vault,fetcher,requests:()=>requests,releases:()=>releases};
}
test('QA: saved selection enables startup without inference and explicit partial configuration cannot mix',async t=>{
  const f=await fixture(t);
  const provider=await createProvider({mode:'chatgpt',accountId:'',model:'',dataDirectory:f.directory,vault:f.vault,fetcher:f.fetcher});
  assert.equal(provider.model,'selected');assert.equal(f.requests(),1);assert.equal(f.releases(),0);
  await provider.close();assert.equal(f.releases(),1);
  await assert.rejects(createProvider({mode:'chatgpt',accountId:id,model:'',dataDirectory:f.directory,vault:f.vault,fetcher:f.fetcher}),{code:'provider_configuration'});
  assert.equal(f.requests(),1);
});
test('QA: malformed saved configuration fails closed before credential/network access',async t=>{
  const f=await fixture(t);
  for(const value of ['{',JSON.stringify({version:1,accountId:id,model:'selected',access_token:'SYNTHETIC'})]){
    await writeFile(join(f.directory,'connection.json'),value);
    await assert.rejects(createProvider({mode:'chatgpt',accountId:'',model:'',dataDirectory:f.directory,vault:f.vault,fetcher:f.fetcher}),{code:'provider_configuration'});
  }
  assert.equal(f.requests(),0);assert.equal(f.releases(),0);
});
