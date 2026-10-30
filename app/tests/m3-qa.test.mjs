import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../store.mjs';
const result=source=>({reply:'Synthetic shared scene.',memories:[{kind:'fact',key:'compass',text:'The compass is silver.',sources:[source]}],threads:[],relationship:[],thoughts:[],scene:null});
test('QA replacement interruption survives reopen without resurrecting deleted state or losing owner unpin',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'storychat-m3qa-'));const path=join(dir,'story.sqlite');let store=new Store(path);t.after(async()=>{store.close();await rm(dir,{recursive:true,force:true});});
 const c=store.createCharacter({name:'Nera',definition:'Synthetic adult navigator.'}),p=store.createPersona({name:'Sol',definition:'Synthetic adult visitor.'});const story=store.createStory({characterId:c.id,personaId:p.id,title:'Synthetic coast'});
 const first=store.beginTurn(story.id,{requestId:'first',text:'Our compass is silver.'});store.finishTurn(story.id,first.generation.id,result(first.generation.userMessageId));
 let s=store.getStory(story.id);store.editMemory(story.id,s.memories[0].id,{pinned:true});store.editMemory(story.id,s.memories[0].id,{pinned:false});s=store.getStory(story.id);
 const replacement=store.beginReplacement(story.id,{requestId:'replace',generationId:first.generation.id,revision:s.revision});assert.equal(replacement.context.memories[0].pinned,false);store.close();store=new Store(path);
 s=store.getStory(story.id);assert.equal(s.generations.at(-1).status,'interrupted');assert.equal(s.memories[0].pinned,false);assert.throws(()=>store.finishTurn(story.id,replacement.generation.id,result(replacement.generation.userMessageId)),{code:'conflict'});
 store.deleteMemory(story.id,s.memories[0].id);s=store.getStory(story.id);const retry=store.beginReplacement(story.id,{requestId:'retry',generationId:replacement.generation.id,revision:s.revision});store.finishTurn(story.id,retry.generation.id,result(retry.generation.userMessageId));assert.equal(store.getStory(story.id).memories.length,0);
 const independent=store.createStory({characterId:c.id,personaId:p.id,title:'Independent'});assert.equal(store.getStory(independent.id).messages.length,0);
});

test('QA deleting a corrected fact after a later turn prevents rollback resurrection',t=>{
 const store=new Store(':memory:');t.after(()=>store.close());const c=store.createCharacter({name:'Nera',definition:'Synthetic adult navigator.'}),p=store.createPersona({name:'Sol',definition:'Synthetic adult visitor.'});const story=store.createStory({characterId:c.id,personaId:p.id,title:'Synthetic correction'});
 const first=store.beginTurn(story.id,{requestId:'first',text:'A silver compass.'});store.finishTurn(story.id,first.generation.id,result(first.generation.userMessageId));
 let state=store.getStory(story.id);const memoryId=state.memories[0].id;store.editMemory(story.id,memoryId,{text:'The compass is amber.',pinned:true});
 const later=store.beginTurn(story.id,{requestId:'later',text:'Continue the scene.'});store.finishTurn(story.id,later.generation.id,{...result(later.generation.userMessageId),memories:[]});store.deleteMemory(story.id,memoryId);state=store.getStory(story.id);
 const replacement=store.beginReplacement(story.id,{requestId:'replace-later',generationId:later.generation.id,revision:state.revision});assert.equal(replacement.context.memories.length,0);
 store.finishTurn(story.id,replacement.generation.id,result(replacement.generation.userMessageId));assert.equal(store.getStory(story.id).memories.length,0);
});
