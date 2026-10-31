import {randomUUID} from 'node:crypto';
import {collectMediaReferences,MAX_MEDIA_BACKUP_BYTES} from './media.mjs';
export async function exportBundle(data,media){const refs=collectMediaReferences(data);if(!media){if(refs.size)throw Error('Media storage is required.');return data;}return {format:'storychat-media',version:1,data,assets:await media.exportAssets(refs)};}
export function splitBundle(value){if(value?.format!=='storychat-media')return {data:value,assets:[]};if(value.version!==1||Object.keys(value).sort().join(',')!=='assets,data,format,version')throw Error('Invalid media backup.');if(Buffer.byteLength(JSON.stringify(value))>MAX_MEDIA_BACKUP_BYTES)throw Error('Backup too large.');return {data:value.data,assets:value.assets};}
export async function stageBundle(value,media){const {data,assets}=splitBundle(value),refs=collectMediaReferences(data);if(!media){if(refs.size||assets.length)throw Error('Media storage is required.');return {data,rollback:async()=>{}};}const staged=await media.restoreAssets(assets,refs);return {data,rollback:staged.rollback};}

// Item previews decode/check all media without installing it. Item imports always
// allocate new media identities, so exported IDs cannot replace existing files.
export async function validateItemBundle(value,media){
 const {data,assets}=splitBundle(value),refs=collectMediaReferences(data);
 if(!media){if(refs.size||!Array.isArray(assets)||assets.length)throw Object.assign(Error('Media storage is required.'),{code:'invalid'});}
 else await media.restoreAssets(assets,refs,{validateOnly:true});
 return {data,assets};
}
export async function stageItemBundle(value,media){
 const checked=await validateItemBundle(value,media),data=structuredClone(checked.data),assets=structuredClone(checked.assets);
 const ids=new Map(assets.map(a=>[a.meta.id,randomUUID()]));
 for(const asset of assets)asset.meta.id=ids.get(asset.meta.id);
 for(const entry of data.library)if(entry.data.cover)entry.data.cover=ids.get(entry.data.cover);
 const staged=media?await media.restoreAssets(assets,collectMediaReferences(data)):{rollback:async()=>{}};
 return {data,rollback:staged.rollback};
}
