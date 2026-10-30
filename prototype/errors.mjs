export class ProviderError extends Error {
  constructor(code, message) { super(message); this.name = 'ProviderError'; this.code = code; }
}
export async function checkedFetch(fetcher, url, options = {}) {
  let response;
  try { response = await fetcher(url, { ...options, signal: options.signal ?? AbortSignal.timeout(30000), redirect: 'error' }); }
  catch { throw new ProviderError('network_error', 'Request failed or timed out; no automatic retry was made.'); }
  if (!response.ok) {
    let code = 'http_' + response.status;
    try {
      const body = await response.json();
      const candidate = body.error?.code ?? body.error;
      if (typeof candidate === 'string' && /^[a-z_]{1,100}$/.test(candidate)) code = candidate;
    } catch {}
    throw new ProviderError(code, 'Provider rejected the request. Check sign-in, selected account, and ChatGPT usage settings.');
  }
  return response;
}
