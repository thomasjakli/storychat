// Durable state is not a prompt. Select evidence without mutating stored records.
export const CONTEXT_CHARACTERS = 120000;
export const CONTEXT_BYTES = 128000;
const normalize = value => value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
const tokens = value => new Set(normalize(value).match(/[\p{L}\p{N}]{3,}/gu) ?? []);
const stopwords = new Set('the and that this with from have what would about your you our are was were can could should continue next then der die das und ein eine einer einen einem mit von ist sind war wie was wir ich du sie den dem des auch weiter bitte'.split(' '));
const project = entry => ({...structuredClone(entry), sources: [...new Set(entry.sources)].slice(-16)});

export function selectContext(story, context, replySourceId) {
  const thoughtIds = new Set(story.messages.filter(m => m.kind === 'thought').map(m => m.id));
  context.memories = [];
  context.threads = [];
  context.relationship = [];
  context.thoughts = [];
  // The stored summary is a legacy, first-record excerpt. Selected structured
  // evidence is authoritative; repeating the excerpt would reintroduce stale facts.
  context.summary = '';
  if (context.scene) context.scene = project(context.scene);
  if (replySourceId) context.replySourceId = replySourceId;
  const refreshSources = () => {
    context.sourceIds = [...new Set([
      ...context.messages.map(m => m.id),
      ...['memories','threads','relationship','thoughts'].flatMap(key => context[key].flatMap(m => m.sources)),
      ...(context.scene?.sources ?? []),
    ])].filter(id => !thoughtIds.has(id));
    if (replySourceId) context.sourceIds.push(replySourceId);
  };
  const fits = () => {
    refreshSources();
    const serialized = JSON.stringify(context);
    return serialized.length <= CONTEXT_CHARACTERS && Buffer.byteLength(serialized) <= CONTEXT_BYTES;
  };
  const mandatory = new Set(story.memories.filter(m => m.pinned || m.corrected));
  // Keep alternative facts alongside protected conflicting facts.
  const protectedKeys = new Set([...mandatory].filter(m => m.kind === 'fact').map(m => normalize(m.key)));
  for (const m of story.memories) if (m.kind === 'fact' && protectedKeys.has(normalize(m.key))) mandatory.add(m);
  context.memories.push(...[...mandatory].map(project));
  if (!fits()) throw Object.assign(new Error('Protected story context exceeds the request budget. Export a backup, then review oversized pinned/corrected facts, suppression records or character/persona definitions; nothing was removed.'), {code:'context_limit'});
  const initial = JSON.stringify(context);
  // Reserve room for a compact, deterministic excerpt of selected evidence.
  let remainingCharacters = CONTEXT_CHARACTERS - initial.length - 12000;
  let remainingBytes = CONTEXT_BYTES - Buffer.byteLength(initial) - 24000;

  const query = tokens(context.messages.at(-1)?.text ?? '');
  for (const word of stopwords) query.delete(word);
  const sceneTokens = tokens(context.scene?.text ?? '');
  const score = entry => {
    const words = tokens(`${entry.key} ${entry.text}`);
    let value = 0;
    for (const word of query) if (words.has(word)) value += 8;
    for (const word of sceneTokens) if (!stopwords.has(word) && words.has(word)) value += 1;
    return value;
  };
  const candidates = [];
  for (const category of ['memories','threads','relationship','thoughts']) {
    story[category].forEach((entry,index) => {
      if (mandatory.has(entry)) return;
      candidates.push({category, entry, index, score: score(entry), pending: category === 'threads' && entry.status === 'pending'});
    });
  }
  for (const m of story.messages.filter(m => m.kind === 'thought' && !m.superseded && m.sources?.length).slice(-8)) {
    const entry = {id:m.id,key:'thought.'+m.id,text:m.text,sources:m.sources,revision:story.revision};
    candidates.push({category:'thoughts',entry,index:story.thoughts.length + candidates.length,score:score(entry),pending:false});
  }
  // Relevant evidence first; unresolved plans outrank unrelated historic records.
  candidates.sort((a,b) => Number(b.score > 0)-Number(a.score > 0) || Number(b.pending)-Number(a.pending) || b.score-a.score || (b.entry.revision ?? 0)-(a.entry.revision ?? 0) || b.index-a.index);
  const selected = new Set(mandatory);
  const factGroups = new Map();
  for (const m of story.memories) if(m.kind === 'fact') {
    const key = normalize(m.key);
    if (!factGroups.has(key)) factGroups.set(key, []);
    factGroups.get(key).push(m);
  }
  for (const candidate of candidates) {
    if (selected.has(candidate.entry)) continue;
    const entries = candidate.category === 'memories' && candidate.entry.kind === 'fact'
      ? factGroups.get(normalize(candidate.entry.key)).filter(entry => !selected.has(entry)) : [candidate.entry];
    const projected = entries.map(project);
    // Conservative additive accounting includes every possible new whitelist ID,
    // even duplicates. Avoid serializing the full prompt for every stored record.
    const addition = projected.map(entry => JSON.stringify(entry) + ',' + entry.sources.map(id => JSON.stringify(id) + ',').join('')).join(',');
    const characters = addition.length, bytes = Buffer.byteLength(addition);
    if (characters > remainingCharacters || bytes > remainingBytes) continue;
    context[candidate.category].push(...projected);
    remainingCharacters -= characters;
    remainingBytes -= bytes;
    for (const entry of entries) selected.add(entry);
  }
  context.summary = [...context.memories.map(m => `[${m.kind}${m.conflict ? ', conflicting' : ''}] ${m.text}`), ...context.threads.map(m => `[${m.status}] ${m.text}`), ...context.relationship.map(m => `[relationship] ${m.text}`)].join('\n').slice(0, 6000);
  refreshSources();
  // Mandatory evidence may leave less than the summary reservation. The excerpt
  // is redundant with selected structured state and may be shortened safely.
  while (!fits() && context.summary.length) context.summary = context.summary.slice(0, Math.floor(context.summary.length / 2));
  if (!fits()) throw Object.assign(new Error('Protected story context exceeds the request budget; review protected facts and definitions after exporting a backup. Nothing was removed.'), {code:'context_limit'});
  return structuredClone(context);
}
