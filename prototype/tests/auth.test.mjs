import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, createHash } from 'node:crypto';
import { transaction, authorizationUrl, consumeCallback, verifyIdToken, tokenRecord, exchangeCode, signIn, ISSUER, RESOURCE } from '../auth.mjs';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'synthetic-test-key', alg: 'RS256', use: 'sig' };
const now = Date.now();
const claims = { iss: ISSUER, sub: 'synthetic-user', aud: 'client-test', nonce: 'test-nonce', exp: Math.floor(now / 1000) + 600 };
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
function jwt(changes = {}, header = {}) {
  const body = `${encode({ alg: 'RS256', kid: jwk.kid, ...header })}.${encode({ ...claims, ...changes })}`;
  return body + '.' + sign('RSA-SHA256', Buffer.from(body), privateKey).toString('base64url');
}
const fetchJwks = async url => { assert.equal(url, ISSUER + '/.well-known/jwks.json'); return Response.json({ keys: [jwk] }); };
const identity = { clientId: 'client-test', nonce: 'test-nonce', subject: 'synthetic-user', fetcher: fetchJwks, now };
const callback = tx => new URL(`${tx.redirectUri}?state=${tx.state}&code=test-code&client_id=client-test`);
const tokens = { access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', token_type: 'Bearer', expires_in: 3600, scope: 'openid chatgpt.tokens.use.direct' };

test('authorization uses random independent state/nonce and S256 PKCE', () => {
  const tx = transaction('urn:uuid:test', 'http://127.0.0.1:1234/auth/callback');
  const other = transaction(tx.hostId, tx.redirectUri);
  assert.notEqual(tx.state, other.state); assert.notEqual(tx.nonce, other.nonce); assert.notEqual(tx.verifier, other.verifier);
  const url = new URL(authorizationUrl(tx));
  assert.equal(url.origin, ISSUER);
  assert.equal(url.searchParams.get('code_challenge'), createHash('sha256').update(tx.verifier).digest('base64url'));
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('resource'), RESOURCE);
  assert.equal(url.searchParams.get('nonce'), tx.nonce);
  assert.ok(!url.toString().includes(tx.verifier));
});
test('callback requires matching state and registration, is one-use and expires', () => {
  const tx = transaction('host', 'http://127.0.0.1:1234/auth/callback');
  assert.deepEqual(consumeCallback(tx, callback(tx)), { code: 'test-code', clientId: 'client-test' });
  assert.throws(() => consumeCallback(tx, callback(tx)), { code: 'invalid_callback' });
  const mismatch = transaction('host', tx.redirectUri);
  assert.throws(() => consumeCallback(mismatch, new URL(tx.redirectUri + '?state=wrong&code=x&client_id=y')), { code: 'invalid_state' });
  const expired = { ...transaction('host', tx.redirectUri), expiresAt: now - 1 };
  assert.throws(() => consumeCallback(expired, callback(expired)), { code: 'invalid_callback' });
  const denied = transaction('host', tx.redirectUri);
  assert.throws(() => consumeCallback(denied, new URL(`${tx.redirectUri}?state=${denied.state}&error=access_denied`)), { code: 'authorization_denied' });
  const returning = transaction('host', tx.redirectUri, { client_id: 'registered-client' });
  assert.throws(() => consumeCallback(returning, callback(returning)), { code: 'client_mismatch' });
});
test('JWT checks signature and issuer/audience/nonce/subject/expiry before accepting identity', async t => {
  assert.equal((await verifyIdToken(jwt(), identity)).sub, 'synthetic-user');
  const invalid = [
    jwt({ iss: 'https://attacker.invalid' }), jwt({ aud: 'wrong-client' }), jwt({ nonce: 'wrong' }),
    jwt({ sub: 'other-user' }), jwt({ exp: Math.floor(now / 1000) - 1 }), jwt({ nbf: Math.floor(now / 1000) + 600 }),
    jwt({ aud: ['client-test', 'other'], azp: 'other' }), jwt({}, { alg: 'none' }), jwt({}, { kid: 'unknown' }),
    jwt().split('.').slice(0, 2).join('.') + '.invalid', 'broken',
  ];
  for (const [i, token] of invalid.entries()) await t.test(`reject identity ${i}`, () => assert.rejects(verifyIdToken(token, identity), { code: 'invalid_identity' }));
});
test('token records require subscription scope and renewable Bearer credentials', () => {
  assert.equal(tokenRecord(tokens, {}, claims, 'client-test').subject, claims.sub);
  for (const mutation of [{ scope: 'openid' }, { refresh_token: undefined }, { access_token: '' }, { token_type: 'Basic' }, { expires_in: 0 }]) {
    assert.throws(() => tokenRecord({ ...tokens, ...mutation }, {}, claims, 'client-test'), { code: 'permission_missing' });
  }
});
test('code exchange sends verifier and validates signed ID token nonce', async () => {
  const tx = transaction('host', 'http://127.0.0.1:1234/auth/callback');
  let exchanges = 0;
  const fetcher = async (url, options) => {
    if (url.endsWith('/token')) {
      exchanges++;
      assert.equal(options.body.get('code_verifier'), tx.verifier);
      assert.equal(options.body.get('redirect_uri'), tx.redirectUri);
      assert.equal(options.body.get('client_id'), 'client-test');
      assert.equal(options.redirect, 'error');
      return Response.json({ ...tokens, id_token: jwt({ nonce: tx.nonce }) });
    }
    return fetchJwks(url);
  };
  assert.equal((await exchangeCode(tx, callback(tx), fetcher)).access_token, tokens.access_token);
  await assert.rejects(exchangeCode(tx, callback(tx), fetcher), { code: 'invalid_callback' });
  assert.equal(exchanges, 1);
});

test('loopback sign-in delivers a complete browser success response before shutdown', { timeout: 10000 }, async () => {
  let browserResult, authorization, tokenCalls = 0;
  const fetcher = async (url, options) => {
    if (url.endsWith('/token')) {
      tokenCalls++;
      assert.equal(options.body.get('redirect_uri'), authorization.searchParams.get('redirect_uri'));
      const verifier = options.body.get('code_verifier');
      assert.equal(createHash('sha256').update(verifier).digest('base64url'), authorization.searchParams.get('code_challenge'));
      return Response.json({ ...tokens, id_token: jwt({ nonce: authorization.searchParams.get('nonce') }) });
    }
    return fetchJwks(url);
  };
  const record = await signIn('urn:uuid:synthetic-loopback', undefined, url => {
    authorization = new URL(url);
    const redirect = new URL(authorization.searchParams.get('redirect_uri'));
    assert.equal(redirect.hostname, '127.0.0.1');
    redirect.search = new URLSearchParams({ state: authorization.searchParams.get('state'), code: 'synthetic-code', client_id: 'client-test' });
    // Catch immediately so a failed connection cannot become an unhandled rejection.
    browserResult = fetch(redirect, { signal: AbortSignal.timeout(5000) }).then(async response => ({ status: response.status, text: await response.text(), cache: response.headers.get('cache-control'), referrer: response.headers.get('referrer-policy') })).catch(error => ({ error }));
  }, fetcher);
  const browser = await browserResult;
  assert.ifError(browser.error);
  assert.equal(browser.status, 200);
  assert.equal(browser.text, 'Storychat connected. You can close this window.');
  assert.equal(browser.cache, 'no-store');
  assert.equal(browser.referrer, 'no-referrer');
  assert.equal(record.access_token, tokens.access_token);
  assert.equal(tokenCalls, 1);
});

test('loopback denial delivers browser failure and never exchanges or accepts credentials', { timeout: 10000 }, async () => {
  let browserResult, tokenCalls = 0;
  await assert.rejects(signIn('urn:uuid:synthetic-denial', undefined, url => {
    const authorization = new URL(url);
    const redirect = new URL(authorization.searchParams.get('redirect_uri'));
    redirect.search = new URLSearchParams({ state: authorization.searchParams.get('state'), error: 'access_denied' });
    browserResult = fetch(redirect, { signal: AbortSignal.timeout(5000) }).then(async response => ({ status: response.status, text: await response.text() })).catch(error => ({ error }));
  }, async () => { tokenCalls++; assert.fail('denial must never exchange credentials'); }), { code: 'authorization_denied' });
  const browser = await browserResult;
  assert.ifError(browser.error);
  assert.equal(browser.status, 400);
  assert.equal(browser.text, 'Sign-in failed. Return to the terminal for a safe error description.');
  assert.equal(tokenCalls, 0);
});
