// Explicit opt-in six-request writing evaluation. Synthetic fixtures only; no recurring work.
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Vault} from '../prototype/vault.mjs';
import {ChatGPTProvider} from '../prototype/provider.mjs';
import {Store,outputSchema,validateOutput} from '../app/store.mjs';
import {storyInstructions} from '../app/provider.mjs';
if(process.argv[2]!=='--run-six'||!process.env.STORYCHAT_EVAL_MODEL)throw Error('Explicit --run-six and STORYCHAT_EVAL_MODEL required. Uses at most six subscription requests, no retries.');
const output=resolve(process.env.STORYCHAT_EVAL_OUTPUT||'analysis/progression-live-results.json');
if(await stat(output).catch(()=>null))throw Error('Output already exists; refusing accidental repeated evaluation.');
const beforeSource=execFileSync('git',['show','64e56bea1a613b3cf0293aa5e8767c0b2e309d04:app/provider.mjs'],{encoding:'utf8'});
const before=beforeSource.match(/const instructions = `([\s\S]*?)`;/)[1];
const beforeStore=execFileSync('git',['show','64e56bea1a613b3cf0293aa5e8767c0b2e309d04:app/store.mjs'],{encoding:'utf8'});
const beforeContextInstructions=beforeStore.match(/instructions: '([^']+)'/)[1];
const scenarios=[
 {name:'quiet initiative',definition:'Rowan is an adult reserved cartographer maintaining a small mountain observatory. Speaks plainly, enjoys careful practical work, and is curious but not intrusive.',opening:'Rowan sets two mugs on the observatory table. "The rain may keep us here a while."',user:'I settle into the chair. "All right."'},
 {name:'repeated reassurance',definition:'Mara is an adult botanist preparing a community greenhouse opening. She is warm, dryly humorous, and tends to express care through practical actions.',opening:'Mara says, "No hurry. Take your time."',history:[['user','"Thanks."'],['assistant','Mara smiles gently. "Really, there is no rush. We can take our time."']],user:'"Okay." I glance around the greenhouse.'},
 {name:'German discovery',definition:'Jona ist ein erwachsener Uhrmacher. Zurückhaltend, neugierig und pragmatisch; er erklärt Dinge lieber an einem konkreten Beispiel als in langen Reden.',opening:'Jona legt sein Werkzeug ab. „Der Laden ist heute ungewöhnlich ruhig.“',user:'„Dann haben wir ja etwas Zeit.“ Ich schaue zu seinem Arbeitstisch.'}
];
const results={scope:'paired synthetic comparison of old/new provider and context guidance; identical narrative data/source IDs, current reserved-reply contract for both; not context-length evaluation or full historical-stack replay',model:process.env.STORYCHAT_EVAL_MODEL,maximumRequests:6,startedAt:new Date().toISOString(),results:[]};
await mkdir(resolve(output,'..'),{recursive:true});
const persist=()=>writeFile(output,JSON.stringify(results,null,2),{mode:0o600});await persist();
const vault=new Vault(process.env.STORYCHAT_DATA_DIR||'data/provider-spike',process.env.STORYCHAT_KEY_DIR||'secrets/provider-spike');
await vault.locked(async()=>{const data=await vault.load(),accounts=Object.entries(data.accounts);if(accounts.length!==1)throw Error('Expected exactly one local account; select explicitly in harness before running.');const[id,account]=accounts[0];const provider=new ChatGPTProvider(account,async replacement=>{data.accounts[id]=replacement;await vault.save(data);});const models=await provider.listModels();if(!models.some(m=>m.slug===results.model))throw Error('Explicit model unavailable; no fallback.');
for(const fixture of scenarios){const store=new Store(':memory:');const c=store.createCharacter({name:fixture.name==='German discovery'?'Jona':fixture.name==='quiet initiative'?'Rowan':'Mara',definition:fixture.definition,opening:fixture.opening}),p=store.createPersona({name:'Ari',definition:'An adult visitor; choices and feelings belong to the player.'});const story=store.createStory({characterId:c.id,personaId:p.id,title:fixture.name});store.change(story.id,s=>{for(const[role,text]of fixture.history||[])s.messages.push({id:crypto.randomUUID(),role,text,createdAt:new Date().toISOString()});});const {context}=store.beginTurn(story.id,{requestId:crypto.randomUUID(),text:fixture.user});
for(const[label,instructions]of [['before',before],['after',storyInstructions]]){const requestContext={...context,instructions:label==='before'?beforeContextInstructions:context.instructions};const entry={scenario:fixture.name,variant:label,context:requestContext};results.results.push(entry);await persist();try{entry.output=await provider.generateStructured({model:results.model,input:[{role:'user',content:JSON.stringify(requestContext)}],sourceIds:context.sourceIds,instructions,schema:outputSchema,validate:(text,sources)=>validateOutput(JSON.parse(text),sources)});entry.status='completed';}catch(e){entry.status='failed';entry.code=e.code||'provider_error';await persist();throw Error('Evaluation stopped on first failure, no automatic retry: '+entry.code);}await persist();}store.close();}
});results.completedAt=new Date().toISOString();await persist();console.log('Six synthetic comparison requests completed; results saved privately.');
