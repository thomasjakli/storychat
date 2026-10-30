import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {MediaStore,collectMediaReferences,MAX_UPLOAD_BYTES} from '../media.mjs';
import {exportBundle,stageBundle} from '../media-transfer.mjs';
import {Store} from '../store.mjs';
import {backupDatabase,restoreDatabase} from '../backup.mjs';
const fixture=()=>sharp({create:{width:90,height:140,channels:3,background:'#628090'}}).png().toBuffer();
test('covers are sanitized, durable and shared references protect deletion',async()=>{
 const root=await mkdtemp(join(tmpdir(),'storychat-media-'));try{const media=new MediaStore(root);const meta=await media.upload(await fixture());assert.equal(meta.mime,'image/webp');assert.equal(meta.width,90);assert.equal((await sharp((await media.get(meta.id)).bytes).metadata()).exif,undefined);assert.equal((await media.usage()).assets,1);const refs=collectMediaReferences({library:[{cover:meta.id}],stories:[{character:{cover:meta.id}}]});await assert.rejects(media.remove(meta.id,refs),{code:'conflict'});assert.equal((await new MediaStore(root).metadata(meta.id)).checksum,meta.checksum);await media.remove(meta.id,new Set());await assert.rejects(media.get(meta.id),{code:'not_found'});}finally{await rm(root,{recursive:true,force:true});}
});
test('invalid formats, paths, oversized bytes and quota fail safely',async()=>{
 const root=await mkdtemp(join(tmpdir(),'storychat-media-'));try{const media=new MediaStore(root,{maxBytes:1});await assert.rejects(media.upload(Buffer.from('<svg>unsafe</svg>')));await assert.rejects(media.get('../secret'));await assert.rejects(media.upload(Buffer.alloc(MAX_UPLOAD_BYTES+1)));await assert.rejects(media.upload(await fixture()),{code:'capacity'});assert.equal((await media.usage()).assets,0);}finally{await rm(root,{recursive:true,force:true});}
});
test('media bundle restore checks checksums, missing references and rolls back staged assets',async()=>{
 const root=await mkdtemp(join(tmpdir(),'storychat-media-'));try{const source=new MediaStore(join(root,'source')),target=new MediaStore(join(root,'target'));const cover=await source.upload(await fixture());const bundle=await exportBundle({library:[{cover:cover.id}]},source);const damaged=structuredClone(bundle);damaged.assets[0].meta.checksum='0'.repeat(64);await assert.rejects(stageBundle(damaged,target));assert.equal((await target.usage()).assets,0);await assert.rejects(stageBundle({...bundle,assets:[]},target));const staged=await stageBundle(bundle,target);assert.equal((await target.metadata(cover.id)).checksum,cover.checksum);await staged.rollback();assert.equal((await target.usage()).assets,0);}finally{await rm(root,{recursive:true,force:true});}
});
test('offline backup restores synthetic media and data to an isolated database',async()=>{
 const root=await mkdtemp(join(tmpdir(),'storychat-media-'));try{const media=new MediaStore(join(root,'source-media')),cover=await media.upload(await fixture());const db=join(root,'source.sqlite'),dest=join(root,'restored.sqlite'),backup=join(root,'backup.json');let store=new Store(db);store.createCharacter({name:'Synthetic explorer',definition:'An original synthetic test guide.',opening:'A new morning.',cover:cover.id});store.close();await backupDatabase(db,backup,media.directory);await restoreDatabase(backup,dest,join(root,'restored-media'));store=new Store(dest);assert.equal(store.library().characters[0].cover,cover.id);store.close();assert.equal((await new MediaStore(join(root,'restored-media')).metadata(cover.id)).checksum,cover.checksum);}finally{await rm(root,{recursive:true,force:true});}
});
