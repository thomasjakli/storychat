import http from 'node:http';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFile, open, unlink } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from './store.mjs';
import { createProvider } from './provider.mjs';
import { protectDirectory } from '../prototype/vault.mjs';

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
  runtime_locked: 'The credential runtime is in use. Stop the other process before starting this server.',
  subscription_sharing_usage_unavailable: 'ChatGPT allowance or access is unavailable. Your story and draft are preserved.'
};
function publicFailure(error) {
  const code = error?.code;
  if (safeProviderErrors[code]) return {code, message: safeProviderErrors[code]};
  if (['invalid','not_found','conflict'].includes(code)) return {code, message: code === 'conflict' ? 'The story changed or a turn is already pending. Refresh before continuing.' : code === 'not_found' ? 'That record was not found.' : 'Check the supplied fields and source references.'};
  return {code: 'generation_failed', message: 'The request did not complete and no model state was applied. Check provider access before explicitly retrying.'};
}
async function body(req) {
  let bytes = 0; const chunks = [];
  for await (const chunk of req) { bytes += chunk.length; if (bytes > 32768) throw fail('invalid','Request too large.'); chunks.push(chunk); }
  try { const value = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error(); return value; }
  catch { throw fail('invalid','Expected JSON object.'); }
}
function send(res,status,data) { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify(data)); }

/** Injectable store/provider make HTTP tests deterministic without live credentials. */
export function createApplication({store, provider, password, origin, secureCookies = false}) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 256) throw new Error('Set STORYCHAT_PASSWORD to a unique password of 12–256 characters.');
  const salt = randomBytes(32), hash = scryptSync(password,salt,32);
  const sessions = new Map(), failures = new Map(), jobs = new Set();
  let active = false;
  const server = http.createServer(async (req,res) => {
    res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer'); res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    try {
      const url = new URL(req.url,'http://localhost'), path = url.pathname;
      const expectedOrigin = origin || `http://${server.address().address === '::1' ? '[::1]' : '127.0.0.1'}:${server.address().port}`;
      // Reject Host rebinding, cross-origin writes, and cross-site browser requests.
      if (req.headers.host !== new URL(expectedOrigin).host || (req.headers.origin && req.headers.origin !== expectedOrigin) || req.headers['sec-fetch-site'] === 'cross-site') return send(res,403,{error:{code:'forbidden',message:'Use the configured application origin.'}});
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
      if (path.startsWith('/api/')) {
        if (!authenticated) return send(res,401,{error:{code:'unauthorized',message:'Owner sign-in required.'}});
        if (req.method === 'POST' && path === '/api/logout') { sessions.delete(token); res.setHeader('Set-Cookie',cookie('')); return send(res,200,{authenticated:false}); }
        if (req.method === 'GET' && path === '/api/library') return send(res,200,store.library());
        const creates = {'/api/characters':'createCharacter','/api/personas':'createPersona','/api/stories':'createStory'};
        if (req.method === 'POST' && creates[path]) return send(res,201,store[creates[path]](await body(req)));
        const match = /^\/api\/stories\/([a-zA-Z0-9-]+)(?:\/(controls|turns|memories)(?:\/([a-zA-Z0-9-]+))?)?$/.exec(path);
        if (!match) return send(res,404,{error:{code:'not_found',message:'Route not found.'}});
        const [,id,action,memoryId]=match;
        if (req.method === 'GET' && !action) return send(res,200,store.getStory(id));
        if (req.method === 'DELETE' && !action) { if (active) throw fail('conflict','A generation is pending.'); store.deleteStory(id); return send(res,200,{deleted:true}); }
        if (req.method === 'PATCH' && action === 'controls') return send(res,200,store.setControls(id,await body(req)));
        if (action === 'memories' && memoryId && req.method === 'PATCH') return send(res,200,store.editMemory(id,memoryId,await body(req)));
        if (action === 'memories' && memoryId && req.method === 'DELETE') return send(res,200,store.deleteMemory(id,memoryId));
        if (req.method === 'POST' && action === 'turns') {
          const data = await body(req);
          const previous = store.getStory(id).generations.find(g=>g.requestId === data.requestId);
          if (previous) { store.beginTurn(id,data); return send(res,202,{generation:previous}); }
          if (active) throw fail('conflict','The instance is already generating.');
          if (provider.unavailable) return send(res,503,{error:publicFailure(provider.unavailable)});
          const {generation,context} = store.beginTurn(id,data); active=true;
          const job = Promise.resolve().then(()=>provider.generate(context,{})).then(output=>store.finishTurn(id,generation.id,output)).catch(error=>{
            try {store.failTurn(id,generation.id,publicFailure(error).code);} catch {}
          }).finally(()=>{active=false; jobs.delete(job);}); jobs.add(job);
          const {context:internalContext,...safeGeneration}=generation;
          return send(res,202,{generation:safeGeneration});
        }
        return send(res,405,{error:{code:'invalid',message:'Method not supported.'}});
      }
      const files = {'/':'index.html','/index.html':'index.html','/app.js':'app.js','/style.css':'style.css','/styles.css':'styles.css','/manifest.webmanifest':'manifest.webmanifest','/icon.svg':'icon.svg'};
      if (req.method !== 'GET' || !files[path]) return send(res,404,{error:{code:'not_found',message:'Not found.'}});
      const extension=files[path].split('.').pop();
      const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',webmanifest:'application/manifest+json',svg:'image/svg+xml'};
      const bytes=await readFile(resolve(root,'public',files[path])); res.writeHead(200,{'Content-Type':types[extension]}); res.end(bytes);
    } catch(error) { if (!res.headersSent) send(res,error.code === 'not_found' ? 404 : error.code === 'conflict' ? 409 : error.code === 'invalid' ? 400 : 500,{error:publicFailure(error)}); else res.end(); }
  });
  return {server, async close() { await new Promise(resolveClose=>server.close(resolveClose)); await Promise.allSettled(jobs); await provider.close?.(); store.close(); }};
}

async function main() {
  const password=process.env.STORYCHAT_PASSWORD;
  if (!password || password.length < 12 || password.length > 256) throw new Error('Set STORYCHAT_PASSWORD to a unique password of 12–256 characters.');
  const host=process.env.STORYCHAT_HOST || '127.0.0.1', origin=process.env.STORYCHAT_ORIGIN;
  if (host !== '127.0.0.1' && host !== '::1' && (!origin || new URL(origin).protocol !== 'https:')) throw new Error('Remote binding requires STORYCHAT_ORIGIN with trusted HTTPS ingress.');
  const db=process.env.STORYCHAT_DB || resolve(root,'data/storychat/storychat.sqlite'); await protectDirectory(dirname(db));
  let lock;
  try { lock=await open(db+'.lock','wx',0o600); }
  catch { throw new Error('Story runtime is already locked. Confirm no server is running before removing the stale database .lock file.'); }
  let provider, app;
  try {
  try { provider=await createProvider({}); }
  catch(error) {provider={name:'chatgpt',model:process.env.STORYCHAT_MODEL || '',unavailable:error,generate:async()=>{throw error;}}; console.error(publicFailure(error).message);}
  app=createApplication({store:new Store(db),provider,password,origin,secureCookies:!!origin?.startsWith('https:')});
  await new Promise((resolveListen,rejectListen)=>{
    const failed=error=>rejectListen(error);
    app.server.once('error',failed);
    app.server.listen(Number(process.env.PORT || 8787),host,()=>{app.server.removeListener('error',failed);resolveListen();});
  });
  console.log(`Storychat: ${origin || `http://${host === '::1' ? '[::1]' : host}:${app.server.address().port}`} (${provider.name}${provider.unavailable ? ', sign-in/configuration needed' : ''})`);
  let stopping=false;
  for (const event of ['SIGINT','SIGTERM']) process.once(event,()=>{if(stopping)return;stopping=true;app.close().then(async()=>{await lock.close();await unlink(db+'.lock');process.exit(0);});});
  } catch(error) { if(app) await app.close(); else await provider?.close?.(); await lock.close(); await unlink(db+'.lock'); throw error; }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(()=>{console.error('Startup failed. Check Node 24, password, runtime permissions and provider configuration.'); process.exitCode=1;});
