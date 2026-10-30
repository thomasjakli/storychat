import { ProviderError } from './errors.mjs';
export const envelopeSchema = {
  type: 'object', additionalProperties: false, required: ['reply', 'memories'],
  properties: {
    reply: { type: 'string' },
    memories: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['kind', 'text', 'source'], properties: {
        kind: { type: 'string', enum: ['fact', 'intention', 'completed_event'] },
        text: { type: 'string' }, source: { type: 'string' }
      } } }
  }
};
export function validateEnvelope(text, allowedSources) {
  const fail = () => { throw new ProviderError('invalid_output', 'Completed output failed validation; no state was applied.'); };
  if (typeof text !== 'string' || text.length > 65536) fail();
  let value; try { value = JSON.parse(text); } catch { fail(); }
  const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).sort().join(',') === keys.sort().join(',');
  if (!exact(value, ['reply', 'memories']) || typeof value.reply !== 'string' || !value.reply.trim() || value.reply.length > 16000 || !Array.isArray(value.memories) || value.memories.length > 10) fail();
  for (const memory of value.memories) {
    if (!exact(memory, ['kind', 'text', 'source']) || !['fact', 'intention', 'completed_event'].includes(memory.kind) || typeof memory.text !== 'string' || !memory.text.trim() || memory.text.length > 2000 || !allowedSources.includes(memory.source)) fail();
  }
  return value;
}
