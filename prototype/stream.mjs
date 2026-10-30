import { ProviderError } from './errors.mjs';
// Byte chunks may split UTF-8 characters and SSE records. Never accept a partial reply.
export async function consumeResponse(body, onDelta = () => {}) {
  if (!body) throw new ProviderError('interrupted', 'Provider returned no stream.');
  const decoder = new TextDecoder();
  let buffer = '', text = '', completed = false;
  const handle = (record) => {
    const data = record.split('\n').filter(x => x.startsWith('data:')).map(x => x.slice(5).trimStart()).join('\n');
    if (!data || data === '[DONE]') return;
    let event; try { event = JSON.parse(data); } catch { throw new ProviderError('invalid_stream', 'Malformed provider event.'); }
    if (completed) throw new ProviderError('invalid_stream', 'Data followed the terminal response.');
    if (event.type === 'response.output_text.delta') {
      if (typeof event.delta !== 'string') throw new ProviderError('invalid_stream', 'Invalid text event.');
      text += event.delta;
      if (text.length > 65536) throw new ProviderError('output_limit', 'Prototype output limit exceeded.');
      onDelta(event.delta);
    }
    if (['response.failed', 'response.incomplete', 'error'].includes(event.type)) {
      const candidate = event.response?.error?.code ?? event.code;
      const code = typeof candidate === 'string' && /^[a-z_]{1,100}$/.test(candidate) ? candidate : event.type;
      throw new ProviderError(code, 'Generation did not complete; discard the partial draft. Check ChatGPT usage or sign in again.');
    }
    if (event.type === 'response.completed') {
      if (event.response?.status && event.response.status !== 'completed') throw new ProviderError('invalid_stream', 'Conflicting terminal status.');
      completed = true;
    }
  };
  try {
    for await (const chunk of body) {
      buffer += decoder.decode(chunk, { stream: true }).replace(/\r\n/g, '\n');
      // Normalize again after concatenation to cover CR/LF split across chunks.
      buffer = buffer.replace(/\r\n/g, '\n');
      if (buffer.length > 1024 * 1024) throw new ProviderError('invalid_stream', 'Provider event exceeded prototype limit.');
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        handle(buffer.slice(0, boundary)); buffer = buffer.slice(boundary + 2);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) handle(buffer);
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError('interrupted', 'Stream interrupted; no state was applied.');
  }
  if (!completed) throw new ProviderError('interrupted', 'Stream ended without response.completed.');
  return text;
}
