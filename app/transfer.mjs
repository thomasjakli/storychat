import {characterFields,validateCharacterFields,personaFields,validatePersonaFields} from './store.mjs';
// Logical application backups never contain provider configuration or credentials.
export const MAX_TRANSFER_BYTES = 8 * 1024 * 1024;
const invalid = () => { throw Object.assign(new Error('Invalid or unsupported story backup.'), {code:'invalid'}); };
const check = value => { if (!value) invalid(); };
function object(value, keys, required = keys) { check(value && typeof value === 'object' && !Array.isArray(value)); check(Object.keys(value).every(k=>keys.includes(k)) && required.every(k=>Object.hasOwn(value,k))); }
const text = (v,max=2000) => check(typeof v==='string' && v.length<=max);
const identifier = v => check(typeof v==='string' && /^[a-zA-Z0-9._:-]{1,100}$/.test(v));
function definition(v,type) { object(v,['id','name','definition','version','createdAt','updatedAt','archived',...(type==='character'?[...characterFields,'draft','favorite']:personaFields)],['id','name','definition','version','createdAt']);identifier(v.id);text(v.name,100);text(v.definition,8000);check(Number.isSafeInteger(v.version)&&v.version>0);text(v.createdAt,100);if(v.updatedAt!==undefined)text(v.updatedAt,100);for(const key of ['archived','favorite','draft'])if(v[key]!==undefined)check(typeof v[key]==='boolean');if(type==='character')validateCharacterFields(v);else validatePersonaFields(v); }

function story(v) {
  object(v,['id','title','character','persona','controls','revision','scene','messages','memories','threads','relationship','thoughts','summary','generations','suppression','thoughtRequests'],['id','title','character','persona','controls','revision','scene','messages','memories','threads','relationship','thoughts','summary','generations','suppression']);
  identifier(v.id);text(v.title,120);definition(v.character,'character');definition(v.persona,'persona');
  object(v.controls,['tone','detail','length']);text(v.controls.tone,100);check(['minimal','balanced','rich'].includes(v.controls.detail)&&['short','medium','long'].includes(v.controls.length));check(Number.isSafeInteger(v.revision)&&v.revision>=0);text(v.summary,12000);
  check(Array.isArray(v.messages)&&v.messages.length<=20000);const ids=new Set();
  for(const m of v.messages){object(m,['id','role','text','createdAt','generationId','superseded','kind','sources','origin','provenance'],['id','role','text','createdAt']);identifier(m.id);check(!ids.has(m.id));ids.add(m.id);check(['user','assistant'].includes(m.role));text(m.text,12000);text(m.createdAt,100);if(m.kind!==undefined)check(['intro','opening','thought'].includes(m.kind)&&m.role==='assistant');if(m.generationId!==undefined)identifier(m.generationId);if(m.superseded!==undefined)check(typeof m.superseded==='boolean');}
  for(const m of v.messages)if(m.kind!=='thought')check(['sources','origin','provenance'].every(k=>m[k]===undefined));
  const thoughtIds=new Set(v.messages.filter(m=>m.kind==='thought').map(m=>m.id));
  for(const m of v.messages)if(m.kind==='thought'){text(m.text,2000);check(['generated','imported'].includes(m.origin));check(Array.isArray(m.sources)&&m.sources.length<=16&&m.sources.every(id=>ids.has(id)&&!thoughtIds.has(id)&&v.messages.findIndex(x=>x.id===id)<v.messages.indexOf(m)));if(m.origin==='generated')check(m.sources.length>0);if(m.provenance!==undefined){object(m.provenance,['source','reference']);text(m.provenance.source,200);text(m.provenance.reference,500);}if(m.origin==='imported')check(m.provenance!==undefined);}
  if(v.thoughtRequests!==undefined){check(Array.isArray(v.thoughtRequests)&&v.thoughtRequests.length<=10000);const seen=new Set();for(const r of v.thoughtRequests){object(r,['requestId','status','revision','createdAt','replaceId','context','messageId','completedAt','error'],['requestId','status','revision','createdAt']);text(r.requestId,100);check(!seen.has(r.requestId));seen.add(r.requestId);check(['completed','cancelled','failed','interrupted'].includes(r.status));check(Number.isSafeInteger(r.revision)&&r.revision>=0&&r.revision<=v.revision);text(r.createdAt,100);for(const k of ['replaceId','messageId'])if(r[k]!==undefined)check(thoughtIds.has(r[k]));for(const k of ['completedAt','error'])if(r[k]!==undefined)text(r[k],100);if(r.context!==undefined){object(r.context,['character','persona','controls','revision','scene','memories','threads','relationship','thoughts','summary','messages','suppression','instructions','sourceIds']);check(Array.isArray(r.context.sourceIds)&&r.context.sourceIds.every(id=>ids.has(id)&&!thoughtIds.has(id)));check(Buffer.byteLength(JSON.stringify(r.context))<=128000);validateContext(r.context,v,ids);}}}
  for(const category of ['memories','threads','relationship','thoughts']){check(Array.isArray(v[category])&&v[category].length<=200);for(const r of v[category]){object(r,['id','key','text','sources','revision',...(category==='memories'?['kind','pinned','corrected','conflict','ownerRevision']:category==='threads'?['status']:[])],['id','key','text','sources','revision']);identifier(r.id);text(r.key,120);text(r.text);check(Number.isSafeInteger(r.revision)&&r.revision>=0);check(Array.isArray(r.sources)&&r.sources.length>0&&r.sources.length<=16&&r.sources.every(s=>ids.has(s)&&!thoughtIds.has(s)));if(r.ownerRevision!==undefined)check(Number.isSafeInteger(r.ownerRevision)&&r.ownerRevision>=0&&r.ownerRevision<=v.revision);if(category==='memories'){check(['fact','belief','event'].includes(r.kind));for(const k of ['pinned','corrected','conflict'])if(r[k]!==undefined)check(typeof r[k]==='boolean');}if(category==='threads')check(['pending','completed','cancelled','superseded'].includes(r.status));}}
  if(v.scene!==null){object(v.scene,['text','fictionalTime','sources','revision']);text(v.scene.text);text(v.scene.fictionalTime,200);check(Number.isSafeInteger(v.scene.revision));check(Array.isArray(v.scene.sources)&&v.scene.sources.length<=16&&v.scene.sources.every(s=>ids.has(s)&&!thoughtIds.has(s)));}
  check(Array.isArray(v.suppression)&&v.suppression.length<=20000);for(const s of v.suppression){object(s,['key','text','reason']);text(s.key,120);text(s.text);check(['correction','deletion'].includes(s.reason));}
  // Export intentionally starts a fresh generation ledger. Historical messages remain.
    check(Array.isArray(v.generations)&&v.generations.length<=10000);
  const generationIds=new Set(v.generations.map(g=>g.id));check(generationIds.size===v.generations.length);
  for(const g of v.generations){
    object(g,['id','requestId','userMessageId','status','revision','createdAt','completedAt','error','context','baseSnapshot','replaces','replacementFingerprint'],['id','requestId','userMessageId','status','revision','createdAt']);
    identifier(g.id);text(g.requestId,100);check(ids.has(g.userMessageId));check(['completed','failed','interrupted','superseded'].includes(g.status));check(Number.isSafeInteger(g.revision)&&g.revision>=0);text(g.createdAt,100);if(g.completedAt!==undefined)text(g.completedAt,100);if(g.error!==undefined)text(g.error,100);if(g.replaces!==undefined)check(generationIds.has(g.replaces));if(g.replacementFingerprint!==undefined)text(g.replacementFingerprint,9000);
    if(g.baseSnapshot){object(g.baseSnapshot,['scene','memories','threads','relationship','thoughts','summary']);story({...v,...g.baseSnapshot,generations:[],thoughtRequests:[]});}
    if(g.context){
      object(g.context,['character','persona','controls','revision','scene','memories','threads','relationship','thoughts','summary','messages','suppression','instructions','sourceIds']);
      text(g.context.instructions,4000);check(Array.isArray(g.context.sourceIds)&&g.context.sourceIds.length<=5000&&g.context.sourceIds.every(s=>ids.has(s)));
      const {instructions,sourceIds,...contextState}=g.context; story({...v,...contextState,id:v.id,title:v.title,messages:v.messages,generations:[],thoughtRequests:[]});
      check(Array.isArray(g.context.messages)&&g.context.messages.length<=6&&g.context.messages.every(m=>ids.has(m.id))); for(const m of g.context.messages){const retained=v.messages.find(x=>x.id===m.id);check(retained&&['role','text','createdAt','generationId'].every(k=>retained[k]===m[k]));object(m,['id','role','text','createdAt','generationId','superseded','kind','sources','origin','provenance'],['id','role','text','createdAt']);text(m.text,12000);check(['user','assistant'].includes(m.role));text(m.createdAt,100);if(m.kind!==undefined)check(['intro','opening','thought'].includes(m.kind)&&m.role==='assistant');if(m.generationId!==undefined)identifier(m.generationId);if(m.superseded!==undefined)check(typeof m.superseded==='boolean');}
    }
  }
}
function validateContext(c,v,ids){
  text(c.instructions,4000);check(Array.isArray(c.messages)&&c.messages.length<=6);check(Array.isArray(c.sourceIds)&&c.sourceIds.length<=5000&&c.sourceIds.every(id=>ids.has(id)));
  const {instructions,sourceIds,...state}=c;story({...v,...state,messages:v.messages,generations:[],thoughtRequests:[]});
  for(const m of c.messages){const retained=v.messages.find(x=>x.id===m.id);check(retained&&m.kind!=='thought'&&['role','text','createdAt','generationId','kind','sources','origin','provenance'].every(k=>JSON.stringify(m[k])===JSON.stringify(retained[k])));}
}
export function validateTransfer(value) {
  check(Buffer.byteLength(JSON.stringify(value))<=MAX_TRANSFER_BYTES);object(value,['format','version','library','stories']);check(value.format==='storychat'&&value.version===1);check(Array.isArray(value.library)&&value.library.length<=2000&&Array.isArray(value.stories)&&value.stories.length<=1000);
  const ids=new Set();for(const entry of value.library){object(entry,['type','data']);check(['character','persona'].includes(entry.type));definition(entry.data,entry.type);check(!ids.has(entry.data.id));ids.add(entry.data.id);}
  ids.clear();for(const s of value.stories){story(s);check(!ids.has(s.id));ids.add(s.id);}return structuredClone(value);
}
export function exportData(store, {includeHistory=false} = {}) {
  return store.transaction(()=>{
    const library=store.db.prepare('SELECT type,data FROM library').all().map(r=>({type:r.type,data:store.definition(JSON.parse(r.data).id,r.type)}));
    const stories=store.db.prepare('SELECT data FROM stories').all().map(r=>{const s=JSON.parse(r.data);if(s.generations.some(g=>g.status==='pending')||(s.thoughtRequests??[]).some(r=>r.status==='pending'))throw Object.assign(new Error('Wait for the active reply before exporting.'),{code:'conflict'});if(!includeHistory){s.generations=[];s.thoughtRequests=[];}return s;});
    return validateTransfer({format:'storychat',version:1,library,stories});
  });
}
export function importData(store,input) {
  const data=validateTransfer(input);
  return store.transaction(()=>{
    for(const e of data.library)if(store.db.prepare('SELECT id FROM library WHERE id=?').get(e.data.id))throw Object.assign(new Error('Backup conflicts with existing library records. Restore into an empty instance.'),{code:'conflict'});
    for(const s of data.stories)if(store.db.prepare('SELECT id FROM stories WHERE id=?').get(s.id))throw Object.assign(new Error('Backup conflicts with existing stories. Restore into an empty instance.'),{code:'conflict'});
    for(const e of data.library){const record=structuredClone(e.data);if(e.type==='character'){const prefs={favorite:record.favorite??false,draft:record.draft??false,archived:record.archived??false};for(const key of ['favorite','draft','archived'])delete record[key];store.db.prepare('INSERT INTO character_preferences(id,data) VALUES(?,?)').run(record.id,JSON.stringify(prefs));}store.db.prepare('INSERT INTO library(id,type,data) VALUES(?,?,?)').run(record.id,e.type,JSON.stringify(record));}for(const s of data.stories)store.save(s);
    return {characters:data.library.filter(e=>e.type==='character').length,personas:data.library.filter(e=>e.type==='persona').length,stories:data.stories.length};
  });
}
