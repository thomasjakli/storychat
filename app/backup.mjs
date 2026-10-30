import {readFile,open,lstat,unlink} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Store} from './store.mjs';
import {exportData,importData,MAX_TRANSFER_BYTES} from './transfer.mjs';
import {acquireRuntimeLock} from '../prototype/runtime-lock.mjs';
import {protectDirectory} from '../prototype/vault.mjs';
export async function backupDatabase(database,output) {
  database=resolve(database);output=resolve(output);if(database===output)throw Error('Backup output must differ from database.');
  const sourceStat=await lstat(database);if(!sourceStat.isFile()||sourceStat.isSymbolicLink())throw Error('Database must be a regular file.');
  const lock=await acquireRuntimeLock(database+'.lock');let store,handle,created=false;
  try {store=new Store(database);const data=exportData(store,{includeHistory:true});handle=await open(output,'wx',0o600);created=true;await handle.writeFile(JSON.stringify(data));await handle.sync();return {stories:data.stories.length};}
  catch(error){await handle?.close();handle=null;if(created)await unlink(output).catch(e=>{if(e.code!=='ENOENT')throw e;});throw error;}finally{await handle?.close();store?.close();await lock.release();}
}
export async function restoreDatabase(input,database) {
  input=resolve(input);database=resolve(database);const stat=await lstat(input);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>MAX_TRANSFER_BYTES)throw Error('Invalid backup file.');
  const bytes=await readFile(input);if(bytes.length>MAX_TRANSFER_BYTES)throw Error('Backup too large.');const data=JSON.parse(bytes.toString('utf8'));
  await protectDirectory(dirname(database));const lock=await acquireRuntimeLock(database+'.lock');let store,created=false;
  try {const reservation=await open(database,'wx',0o600);created=true;await reservation.close();store=new Store(database);return importData(store,data);}
  catch(error){store?.close();store=null;if(created){for(const suffix of ['', '-wal','-shm'])await unlink(database+suffix).catch(e=>{if(e.code!=='ENOENT')throw e;});}throw error;}
  finally{store?.close();await lock.release();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  process.umask(0o077);const [command,first,second]=process.argv.slice(2);
  Promise.resolve().then(()=>{if(!first||!second)throw Error();if(command==='backup')return backupDatabase(first,second);if(command==='restore')return restoreDatabase(first,second);throw Error();}).then(result=>console.log(JSON.stringify(result))).catch(()=>{console.error('Backup operation failed. Check command, private paths, valid backup format and stopped application. Existing destination files are never overwritten.');process.exitCode=1;});
}
