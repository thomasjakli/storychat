import { randomBytes, createHash, createPublicKey, verify, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { checkedFetch, ProviderError } from './errors.mjs';
export const ISSUER = 'https://auth.openai.com';
export const RESOURCE = 'https://api.openai.com/v1';
export const SCOPE = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
export function transaction(hostId, redirectUri, account) {
  const verifier = randomBytes(48).toString('base64url');
  return { hostId, redirectUri, account, verifier, state: randomBytes(32).toString('base64url'), nonce: randomBytes(32).toString('base64url'),
    challenge: createHash('sha256').update(verifier).digest('base64url'), expiresAt: Date.now() + 10 * 60 * 1000, consumed: false };
}
export function authorizationUrl(tx) {
  const url = new URL(ISSUER + '/api/accounts/authorize');
  url.search = new URLSearchParams({ client_id: tx.account?.client_id ?? 'dynamic_agent_client',
    ext_agent_host_id: tx.hostId, response_type: 'code', redirect_uri: tx.redirectUri, scope: SCOPE, resource: RESOURCE,
    state: tx.state, nonce: tx.nonce, code_challenge_method: 'S256', code_challenge: tx.challenge }).toString();
  if (!tx.account) url.searchParams.set('agent_name_hint', 'Storychat');
  // No id_token_hint in the URL: manual copy/open must never print a retained token.
  return url.toString();
}
export function consumeCallback(tx, url) {
  if (tx.consumed || tx.expiresAt <= Date.now()) throw new ProviderError('invalid_callback', 'Sign-in expired or callback already used.');
  tx.consumed = true;
  const state = url.searchParams.get('state') ?? '';
  if (Buffer.byteLength(state) !== Buffer.byteLength(tx.state) || !timingSafeEqual(Buffer.from(state), Buffer.from(tx.state))) throw new ProviderError('invalid_state', 'Sign-in state did not match. Start sign-in again.');
  if (url.searchParams.has('error')) throw new ProviderError('authorization_denied', 'Authorization was denied. No account was changed.');
  const code = url.searchParams.get('code');
  const returnedClientId = url.searchParams.get('client_id');
  if (tx.account && returnedClientId && returnedClientId !== tx.account.client_id) throw new ProviderError('client_mismatch', 'Returned client did not match the selected account.');
  const clientId = tx.account?.client_id ?? url.searchParams.get('client_id');
  if (!code || !clientId || clientId === 'dynamic_agent_client') throw new ProviderError('incomplete_registration', 'Callback did not include a code and issued client ID.');
  return { code, clientId };
}
export async function verifyIdToken(token, { clientId, nonce, subject, fetcher = fetch, now = Date.now() }) {
  try {
    const parts = token.split('.'); if (parts.length !== 3) throw new Error();
    const header = JSON.parse(Buffer.from(parts[0], 'base64url'));
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url'));
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new Error();
    const jwks = await (await checkedFetch(fetcher, ISSUER + '/.well-known/jwks.json')).json();
    const jwk = jwks.keys.find(k => k.kid === header.kid && k.kty === 'RSA' && (!k.use || k.use === 'sig') && (!k.alg || k.alg === 'RS256'));
    if (!jwk || !verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(parts[2], 'base64url'))) throw new Error();
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (claims.iss !== ISSUER || !audiences.includes(clientId) || (audiences.length > 1 && claims.azp !== clientId) ||
      !Number.isFinite(claims.exp) || claims.exp <= now / 1000 || (claims.nbf && claims.nbf > now / 1000) ||
      typeof claims.sub !== 'string' || !claims.sub || (nonce !== undefined && claims.nonce !== nonce) || (subject && claims.sub !== subject)) throw new Error();
    return claims;
  } catch { throw new ProviderError('invalid_identity', 'ID token validation failed; no credentials were replaced.'); }
}
export function tokenRecord(tokens, old = {}, claims, clientId) {
  const scopes = typeof tokens.scope === 'string' ? tokens.scope.split(/\s+/) : old.scopes;
  if (!scopes?.includes('chatgpt.tokens.use.direct') || !tokens.access_token ||
    !(tokens.refresh_token ?? old.refresh_token) || !Number.isFinite(tokens.expires_in) || tokens.expires_in <= 0 || (tokens.token_type ?? '').toLowerCase() !== 'bearer') {
    throw new ProviderError('permission_missing', 'ChatGPT plan permission or required renewable credentials missing.');
  }
  return { ...old, client_id: clientId, subject: claims?.sub ?? old.subject, issuer: ISSUER,
    email: claims?.email ?? old.email, access_token: tokens.access_token, refresh_token: tokens.refresh_token ?? old.refresh_token,
    id_token: tokens.id_token ?? old.id_token, scopes, expires_at: Date.now() + tokens.expires_in * 1000 };
}
export async function exchangeCode(tx, url, fetcher = fetch) {
  const { code, clientId } = consumeCallback(tx, url);
  const tokens = await (await checkedFetch(fetcher, ISSUER + '/api/accounts/oauth/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, code, code_verifier: tx.verifier, redirect_uri: tx.redirectUri, resource: RESOURCE }) })).json();
  const claims = await verifyIdToken(tokens.id_token, { clientId, nonce: tx.nonce, subject: tx.account?.subject, fetcher });
  return tokenRecord(tokens, {}, claims, clientId);
}
export async function signIn(hostId, account, showUrl, fetcher = fetch) {
  let tx, server, timer;
  const result = new Promise((resolve, reject) => {
    server = createServer(async (request, response) => {
      response.setHeader('Cache-Control', 'no-store'); response.setHeader('Referrer-Policy', 'no-referrer');
      const url = new URL(request.url, tx.redirectUri);
      if (request.method !== 'GET' || url.pathname !== '/auth/callback') { response.writeHead(404).end(); return; }
      try { const record = await exchangeCode(tx, url, fetcher); response.end('Storychat connected. You can close this window.'); resolve(record); }
      catch (error) { response.writeHead(400).end('Sign-in failed. Return to the terminal for a safe error description.'); reject(error); }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      tx = transaction(hostId, `http://127.0.0.1:${server.address().port}/auth/callback`, account);
      timer = setTimeout(() => reject(new ProviderError('sign_in_timeout', 'Sign-in expired. Start a fresh attempt.')), 10 * 60 * 1000);
      showUrl(authorizationUrl(tx));
    });
  });
  try { return await result; } finally { clearTimeout(timer); server.closeAllConnections(); server.close(); }
}
