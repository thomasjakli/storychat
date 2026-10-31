import sharp from 'sharp';
import {randomUUID,createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,rm,readdir,lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
export const MAX_UPLOAD_BYTES=8*1024*1024;
export const MAX_MEDIA_BACKUP_BYTES=384*1024*1024;
const validId=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
const fail=(message,code='invalid')=>{throw Object.assign(Error(message),{code});};
const hash=b=>createHash('sha256').update(b).digest('hex');
sharp.cache(false);sharp.concurrency(1);
export function collectMediaReferences(value,result=new Set()) {
 if(Array.isArray(value))for(const v of value)collectMediaReferences(v,result);
 else if(value&&typeof value==='object')for(const [k,v]of Object.entries(value)){if(k==='cover'&&typeof v==='string'&&v){if(!validId(v))fail('Invalid cover reference.');result.add(v);}else collectMediaReferences(v,result);}
 return result;
}
export class MediaStore {
 constructor(directory,{maxBytes=256*1024*1024}={}) {this.directory=resolve(directory);if(!Number.isSafeInteger(maxBytes)||maxBytes<1)fail('Invalid media capacity.');this.maxBytes=maxBytes;this.pending=Promise.resolve();}
 async init(){await mkdir(this.directory,{recursive:true,mode:0o700});const s=await lstat(this.directory);if(!s.isDirectory()||s.isSymbolicLink())fail('Invalid media directory.');}
 path(id){if(!validId(id))fail('Invalid media identifier.');return join(this.directory,id);}
 async exclusive(fn){const next=this.pending.then(fn,fn);this.pending=next.catch(()=>{});return next;}
 async usage(){await this.init();let bytes=0,assets=0;for(const e of await readdir(this.directory,{withFileTypes:true})){if(validId(e.name)&&e.isDirectory()){assets++;for(const f of ['image.webp','thumb.webp'])bytes+=(await lstat(join(this.directory,e.name,f))).size;}}return {bytes,assets,maxBytes:this.maxBytes};}
 async upload(input){return this.exclusive(async()=>{
  if(!Buffer.isBuffer(input)||input.length<12||input.length>MAX_UPLOAD_BYTES)fail('Image must be at most 8 MiB.');
  // Reject vector/document formats before decoding, even though libvips can read some.
  const signature=input.subarray(0,12);const raster=signature.subarray(0,3).equals(Buffer.from([255,216,255]))||signature.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||(signature.toString('ascii',0,4)==='RIFF'&&signature.toString('ascii',8,12)==='WEBP');
  if(!raster)fail('Choose a JPEG, PNG or WebP image.');
  let image,thumb,info;
  try {const pipeline=sharp(input,{limitInputPixels:24000000,failOn:'warning',animated:false}).timeout({seconds:10});const meta=await pipeline.metadata();if(!['jpeg','png','webp'].includes(meta.format)||(meta.pages??1)>1)fail('Animated images are unsupported.');const output=await pipeline.rotate().resize({width:2048,height:2048,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer({resolveWithObject:true});image=output.data;info=output.info;thumb=await sharp(image).resize({width:480,height:720,fit:'inside',withoutEnlargement:true}).webp({quality:78}).toBuffer();}catch{fail('Invalid, oversized or unsupported image.');}
  const id=randomUUID();const record={id,mime:'image/webp',width:info.width,height:info.height,bytes:image.length,checksum:hash(image),thumbnailChecksum:hash(thumb),createdAt:new Date().toISOString()};
  await this.install(record,image,thumb);return record;
 });}
 async install(record,image,thumb){await this.init();const usage=await this.usage();if(usage.bytes+image.length+thumb.length>this.maxBytes)fail('Media storage is full.','capacity');const dest=this.path(record.id),temp=join(this.directory,'.'+randomUUID());await mkdir(temp,{mode:0o700});try{await writeFile(join(temp,'image.webp'),image,{mode:0o600,flag:'wx'});await writeFile(join(temp,'thumb.webp'),thumb,{mode:0o600,flag:'wx'});await writeFile(join(temp,'meta.json'),JSON.stringify(record),{mode:0o600,flag:'wx'});await rename(temp,dest);}finally{await rm(temp,{recursive:true,force:true});}}
 async get(id,{thumbnail=false}={}){const path=this.path(id);let stat;try{stat=await lstat(path);}catch{fail('Image not found.','not_found');}if(!stat.isDirectory()||stat.isSymbolicLink())fail('Invalid media storage.');const filename=join(path,thumbnail?'thumb.webp':'image.webp');const s=await lstat(filename);if(!s.isFile()||s.isSymbolicLink())fail('Invalid media storage.');return {bytes:await readFile(filename),mime:'image/webp'};}
 async metadata(id){await this.get(id);const file=join(this.path(id),'meta.json'),stat=await lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>2048)fail('Invalid media metadata.');return JSON.parse(await readFile(file,'utf8'));}
 async remove(id,references=new Set()){return this.exclusive(async()=>{if(references.has(id))fail('Image is retained by a character, persona or story.','conflict');await this.get(id);await rm(this.path(id),{recursive:true});return {deleted:true};});}
 async exportAssets(ids){const assets=[];for(const id of ids){const meta=await this.metadata(id),image=(await this.get(id)).bytes,thumb=(await this.get(id,{thumbnail:true})).bytes;if(hash(image)!==meta.checksum||hash(thumb)!==meta.thumbnailChecksum)fail('Media checksum mismatch.');assets.push({meta,image:image.toString('base64'),thumbnail:thumb.toString('base64')});}return assets;}
 async restoreAssets(assets,required,{validateOnly=false}={}){return this.exclusive(async()=>{
  if(!Array.isArray(assets)||assets.length>2000)fail('Invalid media backup.');const seen=new Set(),validated=[];
  for(const asset of assets){if(!asset||Object.keys(asset).sort().join(',')!=='image,meta,thumbnail')fail('Invalid media backup.');const m=asset.meta;if(!m||!validId(m.id)||seen.has(m.id)||m.mime!=='image/webp'||!Number.isSafeInteger(m.width)||!Number.isSafeInteger(m.height)||m.width<1||m.height<1||m.width>2048||m.height>2048)fail('Invalid media metadata.');seen.add(m.id);for(const k of ['image','thumbnail'])if(typeof asset[k]!=='string'||asset[k].length>MAX_UPLOAD_BYTES*2||!/^[A-Za-z0-9+/]*={0,2}$/.test(asset[k]))fail('Invalid media bytes.');const image=Buffer.from(asset.image,'base64'),thumb=Buffer.from(asset.thumbnail,'base64');if(image.length!==m.bytes||hash(image)!==m.checksum||hash(thumb)!==m.thumbnailChecksum)fail('Media checksum mismatch.');for(const b of [image,thumb]){if(b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WEBP')fail('Invalid media content.');const decoder=sharp(b,{limitInputPixels:24000000,failOn:'warning'}).timeout({seconds:10});const meta=await decoder.metadata();if(meta.exif||meta.xmp||meta.iptc||meta.icc||(meta.pages??1)>1)fail('Backup image contains unsupported metadata.');const decoded=await decoder.raw().toBuffer({resolveWithObject:true});if(!decoded.data.length||decoded.info.width>2048||decoded.info.height>2048||(b===image&&(decoded.info.width!==m.width||decoded.info.height!==m.height)))fail('Invalid media content.');}validated.push({m,image,thumb});}
  if(required&&([...required].some(id=>!seen.has(id))||[...seen].some(id=>!required.has(id))))fail('Backup media references do not match.');
  if(validateOnly)return {validated:true};
  const created=[];
  try{for(const {m,image,thumb}of validated){try{const old=await this.metadata(m.id);if(old.checksum!==m.checksum||old.thumbnailChecksum!==m.thumbnailChecksum)fail('Media ID collision.','conflict');}catch(e){if(e.code!=='not_found')throw e;await this.install(m,image,thumb);created.push(m.id);}}}catch(e){for(const id of created)await rm(this.path(id),{recursive:true,force:true});throw e;}
  return {created,rollback:async()=>{for(const id of created)await rm(this.path(id),{recursive:true,force:true});}};
 });}
}
