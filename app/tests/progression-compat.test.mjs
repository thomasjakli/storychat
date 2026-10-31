import test from 'node:test';import assert from 'node:assert/strict';
import {Store} from '../store.mjs';import {exportData,validateTransfer} from '../transfer.mjs';
test('legacy six-message lossless contexts retain their historical larger text budget',()=>{
 const store=new Store(':memory:');try{
 const c=store.createCharacter({name:'Keeper',definition:'Original adult cartographer.'}),p=store.createPersona({name:'Guest',definition:'Original adult visitor.'});const s=store.createStory({characterId:c.id,personaId:p.id,title:'Legacy backup'});const begun=store.beginTurn(s.id,{requestId:'legacy',text:'Hello'});store.failTurn(s.id,begun.generation.id);
 const data=exportData(store,{includeHistory:true}),story=data.stories[0],g=story.generations[0],reserved=g.assistantMessageId;delete g.assistantMessageId;delete g.context.replySourceId;g.context.sourceIds=g.context.sourceIds.filter(x=>x!==reserved);
 story.messages[0].text='A'.repeat(5000);for(let i=1;i<6;i++)story.messages.push({id:'old-'+i,role:i%2?'assistant':'user',text:'B'.repeat(5000),createdAt:story.messages[0].createdAt});g.context.messages=structuredClone(story.messages);
 assert.equal(g.context.messages.reduce((n,m)=>n+m.text.length,0),30000);assert.doesNotThrow(()=>validateTransfer(data));
 }finally{store.close();}
});
