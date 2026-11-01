import http from 'node:http';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFile, open, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from './store.mjs';
import {exportBundle,splitBundle,stageBundle,validateItemBundle,stageItemBundle} from './media-transfer.mjs';
import { MediaStore, MAX_UPLOAD_BYTES, MAX_MEDIA_BACKUP_BYTES, collectMediaReferences } from './media.mjs';
import { exportData, importData, MAX_TRANSFER_BYTES, validateTransfer } from './transfer.mjs';
import {validateItem,exportItem,importItem} from './item-transfer.mjs';
import { createProvider } from './provider.mjs';
import { protectDirectory } from '../prototype/vault.mjs';
import { acquireRuntimeLock } from '../prototype/runtime-lock.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const fail = (code, message) => Object.assign(new Error(message), {code});
const safeProviderErrors = {
  sign_in_required: 'ChatGPT sign-in is required. Stop the server and run the local onboarding helper.',
  model_unavailable: 'The selected ChatGPT model is unavailable. Select one from the authorized catalog.',
  provider_unconfigured: 'Configure one ChatGPT account ID and model on the server, then restart.',
  provider_configuration: 'Configure STORYCHAT_ACCOUNT_ID and STORYCHAT_MODEL after local sign-in and catalog discovery, then restart.',
  provider_unavailable: 'ChatGPT is unavailable. Check the protected runtime and complete local sign-in if needed.',
  invalid_output: 'The response failed state validation. No model state was applied. Retry explicitly when ready.',
  context_limit: 'The story context limit was reached. Remove unneeded state before continuing.',
  runtime_locked: 'The credential runtime is locked. Stop the other process. On Windows after a crash, verify every runtime process is stopped before manually removing its lock file. Never delete Linux lock files.',
  runtime_lock_unavailable: 'Linux runtime locking requires util-linux flock and accessible persistent volumes.',
  subscription_sharing_usage_unavailable: 'ChatGPT allowance or access is unavailable. Your story and draft are preserved.'
};
function publicFailure(error) {
  const code = error?.code;
  if (safeProviderErrors[code]) return {code, message: safeProviderErrors[code]};
  if (['invalid','not_found','conflict'].includes(code)) return {code, message: code === 'conflict' ? 'The story changed or a turn is already pending. Refresh before continuing.' : code === 'not_found' ? 'That record was not found.' : 'Check the supplied fields and source references.'};
  return {code: 'generation_failed', message: 'The request did not complete and no model state was applied. Check provider access before explicitly retrying.'};
}
async function body(req, limit = 32768) {
  let bytes = 0; const chunks = [];
  for await (const chunk of req) { bytes += chunk.length; if (bytes > limit) throw fail('invalid','Request too large.'); chunks.push(chunk); }
  try { const value = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error(); return value; }
  catch { throw fail('invalid','Expected JSON object.'); }
}
function send(res,status,data) { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify(data)); }

/** Injectable store/provider make HTTP tests deterministic without live credentials. */
export function createApplication({store, provider, password, origin, secureCookies = false, shutdownTimeoutMs = 130000, media}) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 256) throw new Error('Set STORYCHAT_PASSWORD to a unique password of 12–256 characters.');
  const salt = randomBytes(32), hash = scryptSync(password,salt,32);
  const sessions = new Map(), failures = new Map(), jobs = new Set();
  let importing=false, mutationTail=Promise.resolve();
  let active = false, stopping = false, closing;
  const server = http.createServer(async (req,res) => {
    res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer'); res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    if (stopping) return send(res,503,{error:{code:'shutting_down',message:'The server is stopping. Your saved story is preserved.'}});
    let releaseMutation;
    try {
      const url = new URL(req.url,'http://localhost'), path = url.pathname;
      const expectedOrigin = origin || `http://${server.address().address === '::1' ? '[::1]' : '127.0.0.1'}:${server.address().port}`;
      // Installed-app launches and external links can be cross-site top-level
      // navigations. Permit only the public application shell in that context;
      // APIs, assets, framed documents and every mutation retain the strict rule.
      const shellNavigation = req.method === 'GET' && ['/', '/index.html'].includes(path)
        && req.headers['sec-fetch-mode'] === 'navigate' && req.headers['sec-fetch-dest'] === 'document';
      if (req.headers.host !== new URL(expectedOrigin).host || (req.headers.origin && req.headers.origin !== expectedOrigin)
        || (req.headers['sec-fetch-site'] === 'cross-site' && !shellNavigation)) return send(res,403,{error:{code:'forbidden',message:'Use the configured application origin.'}});
      if (req.method === 'GET' && path === '/health') return send(res,200,{status:'ok'});
      const token = /(?:^|;\s*)storychat=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
      const authenticated = !!token && sessions.get(token) > Date.now();
      if (token && !authenticated) sessions.delete(token);
      const cookie = value => `storychat=${value}; Path=/; HttpOnly; SameSite=Strict; ${secureCookies ? 'Secure; ' : ''}Max-Age=${value ? 28800 : 0}`;
      if (req.method === 'GET' && path === '/api/session') return send(res,200,{authenticated,provider:provider.name,model:provider.model || '',providerError:provider.unavailable ? publicFailure(provider.unavailable) : null});
      if (req.method === 'POST' && path === '/api/login') {
        const key = req.socket.remoteAddress, recent = failures.get(key);
        if (recent && recent.until > Date.now() && recent.count >= 10) return send(res,429,{error:{code:'rate_limited',message:'Too many login attempts. Wait five minutes.'}});
        const data = await body(req), supplied = typeof data.password === 'string' && data.password.length <= 256 ? data.password : '';
        if (!timingSafeEqual(hash,scryptSync(supplied,salt,32))) {
          failures.set(key,{count: recent?.until > Date.now() ? recent.count + 1 : 1,until:Date.now()+300000});
          return send(res,401,{error:{code:'unauthorized',message:'Password not accepted.'}});
        }
        failures.delete(key); for (const [id,expiry] of sessions) if (expiry <= Date.now()) sessions.delete(id);
        if (sessions.size >= 20) sessions.delete(sessions.keys().next().value);
        const id=randomBytes(32).toString('hex'); sessions.set(id,Date.now()+28800000); res.setHeader('Set-Cookie',cookie(id)); return send(res,200,{authenticated:true});
      }
      if(path.startsWith('/speech-spike') || path.startsWith('/speech-assets/')) {
        if(!authenticated)return send(res,401,{error:{code:'unauthorized',message:'Sign in to Storychat first.'}});
        if(req.method!=='GET')return send(res,405,{error:{code:'invalid',message:'Read only.'}});
        const pages=['index.html','app.js','style.css','worker.js','capture.js','assets.json','TRANSFORMERS-LICENSE.txt','WHISPER-LICENSE.txt'];
        const name=path==='/speech-spike/'||path==='/speech-spike'?'index.html':path.slice('/speech-spike/'.length);
        let file;
        if(path.startsWith('/speech-assets/')){const manifest=JSON.parse(await readFile(resolve(root,'speech-spike/assets.json'),'utf8'));const asset=path.slice('/speech-assets/'.length);if(!manifest.files.some(f=>f.path===asset))throw fail('not_found','Unknown speech asset.');file=resolve(process.env.STORYCHAT_SPEECH_ASSETS || resolve(root,'data/speech-assets'),asset);}
        else {if(!pages.includes(name))throw fail('not_found','Unknown speech page.');file=resolve(root,'speech-spike',name);}
        res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; connect-src 'self'; worker-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
        const mime={html:'text/html; charset=utf-8',js:'text/javascript',mjs:'text/javascript',css:'text/css',json:'application/json',wasm:'application/wasm'};
        let bytes;try{bytes=await readFile(file);}catch{throw fail('not_found','Speech assets not prepared.');}
        res.writeHead(200,{'Content-Type':mime[file.split('.').pop()]||'application/octet-stream'});return res.end(bytes);
      }
      if (path.startsWith('/api/')) {
        if (!authenticated) return send(res,401,{error:{code:'unauthorized',message:'Owner sign-in required.'}});
      if(req.method!=='GET' || req.url?.split('?')[0]==='/api/export') {
        const previous=mutationTail;mutationTail=new Promise(resolve=>{releaseMutation=resolve;});await previous;
      }

        if(importing && req.method!=='GET') throw fail('conflict','Import in progress.');
        if (req.method === 'POST' && path === '/api/logout') { sessions.delete(token); res.setHeader('Set-Cookie',cookie('')); return send(res,200,{authenticated:false}); }
        if (req.method === 'GET' && path === '/api/transfer-limits') return send(res,200,{notebookBytes:media?MAX_MEDIA_BACKUP_BYTES:MAX_TRANSFER_BYTES,itemBytes:media?MAX_MEDIA_BACKUP_BYTES:MAX_TRANSFER_BYTES,uploadBytes:MAX_UPLOAD_BYTES});
        if (req.method === 'GET' && path === '/api/characters') {
          const allowed=['q','category','tag','favorites','archived','gender','sort','offset','limit'];
          if ([...url.searchParams.keys()].some(k=>!allowed.includes(k))) throw fail('invalid','Unknown filter.');
          const query=Object.fromEntries(url.searchParams);
          for(const k of ['offset','limit']) if(k in query) {if(!/^\d+$/.test(query[k])) throw fail('invalid','Invalid page.');query[k]=Number(query[k]);}
          if('favorites' in query) {if(!['true','false'].includes(query.favorites)) throw fail('invalid','Invalid filter.');query.favorites=query.favorites==='true';}
          return send(res,200,store.queryCharacters(query));
        }
        if(path==='/api/media' && req.method==='GET') {
          if(!media)throw fail('not_found','Media unavailable.');
          const usage=await media.usage(),refs=collectMediaReferences(exportData(store,{includeHistory:true})),unreferenced=[];
          for(const entry of await readdir(media.directory,{withFileTypes:true}))if(entry.isDirectory() && /^[0-9a-f-]{36}$/.test(entry.name) && !refs.has(entry.name)){const meta=await media.metadata(entry.name);unreferenced.push({id:meta.id,bytes:meta.bytes});}
          return send(res,200,{...usage,maxBytes:media.maxBytes,unreferenced});
        }
        if (path === '/api/media' && req.method==='POST') {
          if(!media) throw fail('invalid','Media storage unavailable.');
          let size=0;const chunks=[];
          for await(const chunk of req) {size+=chunk.length;if(size>MAX_UPLOAD_BYTES) throw fail('invalid','Image too large.');chunks.push(chunk);}
          return send(res,201,{asset:await media.upload(Buffer.concat(chunks))});
        }
        const assetMatch=/^\/api\/media\/([a-zA-Z0-9-]+)(\/thumbnail)?$/.exec(path);
        if(assetMatch && req.method==='DELETE' && !assetMatch[2]) {if(!media)throw fail('not_found','Media unavailable.');return send(res,200,await media.remove(assetMatch[1],collectMediaReferences(exportData(store,{includeHistory:true}))));}
        if(assetMatch && req.method==='GET') {
          if(!media) throw fail('not_found','Media unavailable.');
          const asset=await media.get(assetMatch[1],{thumbnail:!!assetMatch[2]});
          res.writeHead(200,{'Content-Type':asset.mime});return res.end(asset.bytes);
        }
        if (req.method === 'GET' && path === '/api/library') return send(res,200,store.library({summary:url.searchParams.get('summary')==='true'}));
        if (req.method === 'GET' && path === '/api/export') {
          if (active) throw fail('conflict','Wait for generation to finish before exporting.');
          res.setHeader('Content-Disposition','attachment; filename="storychat-export.json"');
          return send(res,200,await exportBundle(exportData(store),media));
        }
        if (req.method === 'POST' && path === '/api/import') {
          if (active) throw fail('conflict','Wait for generation to finish before importing.');
          importing=true;
          try {const value=await body(req,media?MAX_MEDIA_BACKUP_BYTES:MAX_TRANSFER_BYTES);validateTransfer(splitBundle(value).data);const staged=await stageBundle(value,media);try{return send(res,201,importData(store,staged.data));}catch(e){await staged.rollback();throw e;}} finally {importing=false;}
        }
        const itemExport=/^\/api\/(characters|personas)\/([a-zA-Z0-9-]+)\/export$/.exec(path);
        if(req.method==='GET' && itemExport){
          const type=itemExport[1]==='characters'?'character':'persona';
          res.setHeader('Content-Disposition',`attachment; filename="storychat-${type}.json"`);
          return send(res,200,await exportBundle(exportItem(store,type,itemExport[2]),media));
        }
        if(req.method==='POST' && ['/api/items/preview','/api/items/import'].includes(path)){
          const value=await body(req,media?MAX_MEDIA_BACKUP_BYTES:MAX_TRANSFER_BYTES);
          validateItem(splitBundle(value).data);
          await validateItemBundle(value,media);
          if(path.endsWith('/preview')){const bundle=splitBundle(value),entry=bundle.data.library[0],asset=bundle.assets.find(a=>a.meta.id===entry.data.cover);return send(res,200,{type:entry.type,data:entry.data,thumbnail:asset?'data:image/webp;base64,'+asset.thumbnail:null,status:entry.type==='character'&&(entry.data.draft||!entry.data.definition.trim())?'draft':'ready'});}
          if(active)throw fail('conflict','Wait for generation to finish before importing.');
          const staged=await stageItemBundle(value,media);
          try{return send(res,201,importItem(store,staged.data));}catch(error){await staged.rollback();throw error;}
        }
        const definition = /^\/api\/(characters|personas)\/([a-zA-Z0-9-]+)(?:\/(duplicate))?$/.exec(path);
        if (definition) {
          const [,category,recordId,operation]=definition, type=category==='characters'?'character':'persona';
          if(req.method==='GET' && !operation) return send(res,200,store.definition(recordId,type));
          if (req.method==='POST' && operation==='duplicate') return send(res,201,store.duplicateDefinition(type,recordId));
          if (req.method==='DELETE' && !operation) {store.deleteDefinition(type,recordId);return send(res,200,{deleted:true});}
          if (req.method==='PATCH' && !operation) {
            const data=await body(req,131072);
            if(data.cover) {if(!media) throw fail('invalid','Media unavailable.');await media.metadata(data.cover);}
            return send(res,200,store.updateDefinition(type,recordId,data));
          }
          return send(res,405,{error:{code:'invalid',message:'Method not supported.'}});
        }
        const creates = {'/api/characters':'createCharacter','/api/personas':'createPersona','/api/stories':'createStory'};
        if (req.method === 'POST' && creates[path]) {const data=await body(req,131072);if(['/api/characters','/api/personas'].includes(path) && data.cover){if(!media)throw fail('invalid','Media unavailable.');await media.metadata(data.cover);}return send(res,201,store[creates[path]](data));}
        const match = /^\/api\/stories\/([a-zA-Z0-9-]+)(?:\/(controls|turns|memories|thoughts)(?:\/([a-zA-Z0-9-]+))?)?$/.exec(path);
        if (!match) return send(res,404,{error:{code:'not_found',message:'Route not found.'}});
        const [,id,action,memoryId]=match;
        if (req.method === 'GET' && !action) return send(res,200,store.getStory(id));
        if (req.method === 'DELETE' && !action) { if (active) throw fail('conflict','A generation is pending.'); store.deleteStory(id); return send(res,200,{deleted:true}); }
        if (req.method === 'PATCH' && action === 'controls') return send(res,200,store.setControls(id,await body(req)));
        if (action === 'memories' && memoryId && req.method === 'PATCH') return send(res,200,store.editMemory(id,memoryId,await body(req)));
        if (action === 'memories' && memoryId && req.method === 'DELETE') return send(res,200,store.deleteMemory(id,memoryId));
        if(action==='thoughts') {
          if(req.method==='POST' && memoryId==='cancel') {const data=await body(req);if(!data||Object.keys(data).join(',')!=='requestId')throw fail('invalid','Invalid cancellation.');return send(res,200,store.cancelThought(id,data.requestId));}
          if(req.method==='DELETE' && memoryId) return send(res,200,store.deleteThought(id,memoryId));
          if(req.method==='POST' && !memoryId) {
            const data=await body(req);
            const previous=(store.getStory(id).thoughtRequests||[]).find(r=>r.requestId===data.requestId);
            if(previous){store.beginThought(id,data);return send(res,202,{request:previous});}
            if(active)throw fail('conflict','The instance is already generating.');
            if(provider.unavailable)return send(res,503,{error:publicFailure(provider.unavailable)});
            if(typeof provider.generateThought!=='function')throw fail('invalid','Thought generation is unavailable.');
            const {request,context}=store.beginThought(id,data);active=true;
            const job=Promise.resolve().then(()=>provider.generateThought(context)).then(output=>store.finishThought(id,request.requestId,output)).catch(error=>{
              try{store.failThought(id,request.requestId,publicFailure(error).code);}catch{}
            }).finally(()=>{active=false;jobs.delete(job);});jobs.add(job);
            return send(res,202,{request:store.getStory(id).thoughtRequests.find(r=>r.requestId===request.requestId)});
          }
        }
        if (req.method === 'POST' && action === 'turns' && (!memoryId || memoryId==='replace')) {
          const data = await body(req);
          const begin = () => memoryId==='replace' ? store.beginReplacement(id,data) : store.beginTurn(id,data);
          const previous = store.getStory(id).generations.find(g=>g.requestId === data.requestId);
          if (previous) { begin(); return send(res,202,{generation:previous}); }
          if (active) throw fail('conflict','The instance is already generating.');
          if (provider.unavailable) return send(res,503,{error:publicFailure(provider.unavailable)});
          const {generation,context} = begin(); active=true;
          const job = Promise.resolve().then(()=>provider.generate(context,{})).then(output=>store.finishTurn(id,generation.id,output)).catch(error=>{
            try {store.failTurn(id,generation.id,publicFailure(error).code);} catch {}
          }).finally(()=>{active=false; jobs.delete(job);}); jobs.add(job);
          const safeGeneration=store.getStory(id).generations.find(item=>item.id===generation.id);
          return send(res,202,{generation:safeGeneration});
        }
        return send(res,405,{error:{code:'invalid',message:'Method not supported.'}});
      }
      const files = {'/':'index.html','/index.html':'index.html','/narration.js':'narration.js','/explorer.js':'explorer.js','/personas.js':'personas.js','/i18n.js':'i18n.js','/app.js':'app.js','/style.css':'style.css','/styles.css':'styles.css','/manifest.webmanifest':'manifest.webmanifest','/icon.svg':'icon.svg','/icon-192.png':'icon-192.png','/icon-512.png':'icon-512.png','/icon-maskable-512.png':'icon-maskable-512.png'};
      if (req.method !== 'GET' || !files[path]) return send(res,404,{error:{code:'not_found',message:'Not found.'}});
      const extension=files[path].split('.').pop();
      const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',webmanifest:'application/manifest+json',png:'image/png',svg:'image/svg+xml'};
      const bytes=await readFile(resolve(root,'public',files[path])); res.writeHead(200,{'Content-Type':types[extension]}); res.end(bytes);
    } catch(error) { if (!res.headersSent) send(res,error.code === 'not_found' ? 404 : error.code === 'conflict' ? 409 : error.code === 'invalid' ? 400 : 500,{error:publicFailure(error)}); else res.end(); } finally {releaseMutation?.();}
  });
  server.requestTimeout=30000;
  return {server, close() {
    if (closing) return closing;
    stopping = true;
    // Stop accepting first, including keepalive clients, while existing generation
    // jobs continue. Never release the vault/store beneath unfinished work.
    const connectionsClosed = new Promise(resolveClose => server.close(resolveClose));
    server.closeIdleConnections();
    let timer;
    const deadline = new Promise((_,reject) => { timer = setTimeout(() => { server.closeAllConnections(); reject(fail('shutdown_timeout','Shutdown deadline reached. The next startup will mark unfinished turns interrupted.')); }, shutdownTimeoutMs); });
    const cleanup = (async () => { await connectionsClosed; await Promise.allSettled([...jobs]); await provider.close?.(); store.close(); })();
    closing = Promise.race([cleanup,deadline]).finally(() => clearTimeout(timer));
    return closing;
  }};
}

export async function readOwnerPassword(environment = process.env) {
  if (environment.STORYCHAT_PASSWORD && environment.STORYCHAT_PASSWORD_FILE) throw fail('startup_configuration','Set only STORYCHAT_PASSWORD or STORYCHAT_PASSWORD_FILE, not both.');
  let password = environment.STORYCHAT_PASSWORD;
  if (environment.STORYCHAT_PASSWORD_FILE) {
    let handle;
    try {
      handle = await open(environment.STORYCHAT_PASSWORD_FILE, 'r');
      if (!(await handle.stat()).isFile()) throw new Error();
      const buffer = Buffer.alloc(1025);
      let size=0;
      while (size < buffer.length) { const {bytesRead}=await handle.read(buffer,size,buffer.length-size,null); if(!bytesRead)break; size+=bytesRead; }
      if (size > 1024) throw new Error();
      password = new TextDecoder('utf-8',{fatal:true}).decode(buffer.subarray(0,size)).replace(/\r?\n$/, '');
    } catch { throw fail('startup_configuration','Could not read the bounded UTF-8 owner password file. Check its path, permissions and size.'); }
    finally { await handle?.close(); }
  }
  if (!password || password.length < 12 || password.length > 256) throw fail('startup_configuration','Set an owner password of 12–256 characters using STORYCHAT_PASSWORD or STORYCHAT_PASSWORD_FILE.');
  return password;
}

async function main() {
  process.umask(0o077);
  const password=await readOwnerPassword();
  const host=process.env.STORYCHAT_HOST || '127.0.0.1', origin=process.env.STORYCHAT_ORIGIN;
  if (host !== '127.0.0.1' && host !== '::1' && (!origin || new URL(origin).protocol !== 'https:')) throw new Error('Remote binding requires STORYCHAT_ORIGIN with trusted HTTPS ingress.');
  const db=process.env.STORYCHAT_DB || resolve(root,'data/storychat/storychat.sqlite'); await protectDirectory(dirname(db));
  const lock=await acquireRuntimeLock(db+'.lock');
  let provider, app, store;
  try {
  try { provider=await createProvider({}); }
  catch(error) {provider={name:'chatgpt',model:process.env.STORYCHAT_MODEL || '',unavailable:error,generate:async()=>{throw error;}}; console.error(publicFailure(error).message);}
  store = new Store(db);
  const media=new MediaStore(process.env.STORYCHAT_MEDIA_DIR || resolve(dirname(db),'media'),{maxBytes:Number(process.env.STORYCHAT_MEDIA_MAX_BYTES || 268435456)});
  app=createApplication({store,provider,password,origin,media,secureCookies:!!origin?.startsWith('https:')});
  await new Promise((resolveListen,rejectListen)=>{
    const failed=error=>rejectListen(error);
    app.server.once('error',failed);
    app.server.listen(Number(process.env.PORT || 8787),host,()=>{app.server.removeListener('error',failed);resolveListen();});
  });
  let stopping=false;
  for (const event of ['SIGINT','SIGTERM']) process.once(event,()=>{if(stopping)return;stopping=true;app.close().then(async()=>{await lock.release();process.exit(0);}).catch(()=>{console.error('Shutdown deadline or cleanup failure. Stopping; unfinished turns recover as interrupted on next startup.');process.exit(1);});});
  // Readiness is observable across processes; install cleanup before announcing it.
  console.log(`Storychat: ${origin || `http://${host === '::1' ? '[::1]' : host}:${app.server.address().port}`} (${provider.name}${provider.unavailable ? ', sign-in/configuration needed' : ''})`);
  } catch(error) {
    if(app) await app.close(); else { await provider?.close?.(); store?.close(); }
    await lock.release(); throw error;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error=>{const code = error?.code; const safe = ['startup_configuration','runtime_locked','runtime_permissions','runtime_lock_unavailable'].includes(code) ? error.message : 'Check Node 24, password, runtime permissions, HTTPS origin, provider configuration and whether the port is already in use.'; console.error(`Startup failed. ${safe}`); process.exit(1);});
