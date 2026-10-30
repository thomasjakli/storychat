'use strict';

const $ = id => document.getElementById(id);
const state = { session: null, sessionEpoch: 0, library: null, story: null, view: 'loading', poll: null, busy: false, editingMemory: null, lastSignature: '', sendRequest: null };
const activeStatuses = new Set(['pending', 'running', 'streaming']);
const draftPrefix = 'storychat:draft:';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}
function button(text, className, onClick) {
  const node = el('button', className, text); node.type = 'button';
  node.addEventListener('click', onClick); return node;
}
function showNotice(message, error = false) {
  $('notice').textContent = message; $('notice').classList.toggle('error', error); $('notice').hidden = !message;
}
function view(name) {
  state.view = name;
  for (const id of ['loading', 'login-view', 'library-view', 'story-view']) $(id).hidden = id !== name;
  $('page-footer').hidden = name === 'story-view';
}
async function api(path, options = {}) {
  const epoch = state.sessionEpoch;
  let response;
  try {
    response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options,
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  } catch { throw new Error('Connection lost. Your draft is safe. Reconnect before trying again.'); }
  let value;
  try { value = await response.json(); } catch { throw new Error('The server returned an unexpected response. Refresh once your connection is back.'); }
  if (!response.ok) {
    if (response.status === 401 && path !== '/api/login') lockView();
    const error = new Error(value.error?.message || 'This action could not be completed.');
    error.code = value.error?.code; error.status = response.status; throw error;
  }
  if (epoch !== state.sessionEpoch) throw new Error('The notebook was locked. Open it again to continue.');
  return value;
}
function stopPolling() { clearTimeout(state.poll); state.poll = null; }
function lockView() {
  state.sessionEpoch += 1;
  stopPolling(); state.session = null; state.story = null; state.library = null; state.sendRequest = null;
  $('messages').replaceChildren(); $('state-content').replaceChildren(); $('story-list').replaceChildren();
  $('message').value = ''; $('password').value = ''; $('logout').hidden = true; $('provider-badge').hidden = true;
  closeInspector();
  for (const id of ['create-dialog', 'memory-dialog']) if ($(id).open) $(id).close();
  view('login-view');
}
function clearDrafts() {
  try { for (const key of Object.keys(localStorage)) if (key.startsWith(draftPrefix)) localStorage.removeItem(key); } catch { /* Storage can be disabled. */ }
}
function saveDraft() {
  if (!state.story) return;
  try {
    const key = draftPrefix + state.story.id;
    if ($('message').value) localStorage.setItem(key, $('message').value); else localStorage.removeItem(key);
    $('draft-status').textContent = $('message').value ? 'Draft saved on this device.' : 'Your words move the story.';
  } catch { $('draft-status').textContent = 'Draft is kept here while this page stays open.'; }
}
function restoreDraft(id) {
  try { $('message').value = localStorage.getItem(draftPrefix + id) || ''; } catch { $('message').value = ''; }
  $('draft-status').textContent = $('message').value ? 'Your saved draft is ready.' : 'Your words move the story.';
}
async function initialize() {
  try {
    state.session = await api('/api/session');
    if (!state.session.authenticated) { lockView(); return; }
    $('logout').hidden = false;
    const fake = state.session.provider === 'fake';
    $('provider-badge').hidden = false; $('provider-badge').classList.toggle('fake', fake);
    $('provider-badge').textContent = fake ? 'FAKE · DEMO RESPONSES' : 'CHATGPT';
    $('provider-badge').title = fake ? 'Deterministic synthetic responses, not live AI.' : (state.session.model || 'Owner’s ChatGPT connection');
    showNotice(typeof state.session.providerError === 'string' ? state.session.providerError : state.session.providerError?.message || '');
    await loadLibrary();
  } catch (error) { lockView(); showNotice(error.message, true); }
}
async function loadLibrary() {
  stopPolling(); closeInspector();
  state.library = await api('/api/library'); state.story = null; state.lastSignature = '';
  renderLibrary(); view('library-view');
}
function renderLibrary() {
  $('story-list').replaceChildren();
  const stories = state.library.stories || [];
  if (!stories.length) {
    const empty = el('div', 'empty-notebook');
    empty.append(el('span', '', '✦'), el('h2', '', 'An unwritten world.'), el('p', '', 'Begin with a character and a place. The memories will grow from the moments you share.'));
    $('story-list').append(empty); return;
  }
  for (const story of stories) {
    const characterName = story.character?.name || state.library.characters?.find(c => c.id === story.characterId)?.name || 'Your character';
    const card = button('', 'story-card', () => openStory(story.id).catch(error => showNotice(error.message, true)));
    const bottom = el('div', 'card-bottom'); bottom.append(el('span', '', 'Continue the story'), el('span', '', '↗'));
    card.append(el('div', 'card-monogram', Array.from(characterName)[0]?.toUpperCase() || '✦'), el('h2', '', story.title || 'Untitled story'), el('p', '', 'With ' + characterName), bottom);
    $('story-list').append(card);
  }
}
async function openStory(id) {
  stopPolling(); state.lastSignature = ''; state.sendRequest = null;
  state.story = await api('/api/stories/' + encodeURIComponent(id));
  renderStory(true); restoreDraft(id); view('story-view');
  setTimeout(() => $('composer').scrollIntoView({ block: 'end' }), 0);
  schedulePoll();
}
function lastGeneration() { return state.story?.generations?.at(-1); }
function isGenerating() { return state.story?.generations?.some(g => activeStatuses.has(g.status)); }
function schedulePoll(delay = 1500) {
  stopPolling();
  if (state.view === 'story-view' && state.story) state.poll = setTimeout(refreshStory, delay);
}
async function refreshStory() {
  const id = state.story?.id;
  if (!id || state.view !== 'story-view') return;
  try {
    const story = await api('/api/stories/' + encodeURIComponent(id));
    if (state.story?.id !== id || state.view !== 'story-view') return;
    state.story = story; renderStory();
    if (state.sendRequest && story.generations?.some(g => g.requestId === state.sendRequest.requestId)) {
      state.sendRequest = null;
    }
    schedulePoll(isGenerating() ? 1100 : 4500);
  } catch (error) {
    if (state.view !== 'story-view') return;
    showNotice(error.message + ' Checking saved story status; no new reply will be started automatically.', true);
    schedulePoll(5000);
  }
}
function renderStory(force = false) {
  const story = state.story;
  $('story-title').textContent = story.title;
  $('story-kicker').textContent = 'WITH ' + (story.character?.name || 'YOUR CHARACTER');
  const signature = JSON.stringify({ revision: story.revision, messages: story.messages, memories: story.memories, threads: story.threads, thoughts: story.thoughts, relationship: story.relationship, scene: story.scene, generations: story.generations });
  if (force || signature !== state.lastSignature) {
    const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 260;
    const previousCount = $('messages').children.length;
    renderMessages(); renderState(); state.lastSignature = signature;
    if ($('messages').children.length > previousCount && !force) {
      if (nearBottom) $('composer').scrollIntoView({ block: 'end', behavior: 'smooth' });
      else $('jump-latest').hidden = false;
    }
  }
  const controls = story.controls || { tone: 'Natural', detail: 'balanced', length: 'medium' };
  // Do not replace an in-progress preference selection while the owner is editing it.
  if (!$('controls-form').contains(document.activeElement) || force) {
    $('tone').value = controls.tone; $('detail').value = controls.detail; $('length').value = controls.length;
  }
  $('control-summary').textContent = `${controls.tone} · ${controls.detail} · ${controls.length}`;
  renderGeneration();
}
function renderMessages() {
  $('messages').replaceChildren();
  for (const message of state.story.messages || []) {
    const article = el('article', 'message' + (message.role === 'user' ? ' user' : ''));
    article.id = 'message-' + message.id;
    article.append(el('p', 'message-label', message.role === 'user' ? (state.story.persona?.name || 'You') : state.story.character?.name || 'Character'), el('div', 'message-text', message.text));
    $('messages').append(article);
  }
  if (!$('messages').children.length) $('messages').append(el('p', 'empty-state', 'The scene is yours to begin. Write the first moment below.'));
}
function renderGeneration() {
  const status = $('generation-status'); status.replaceChildren(); status.classList.remove('error');
  const generation = lastGeneration(); const pending = isGenerating();
  $('send').disabled = state.busy || pending;
  $('send').textContent = pending ? 'Writing…' : 'Send ↑';
  if (pending) {
    status.textContent = 'The next moment is taking shape. You can leave and return; this reply stays with the story.';
  } else if (generation && ['failed', 'interrupted', 'denied'].includes(generation.status)) {
    status.classList.add('error');
    const explanations = {
      sign_in_required: 'Connect ChatGPT with the local onboarding helper on the server first',
      provider_unavailable: 'Check the protected ChatGPT runtime and complete sign-in if needed',
      model_unavailable: 'Select an available model from the authorized catalog in server configuration',
      invalid_output: 'The reply did not pass story-state validation',
      generation_failed: 'Check the ChatGPT connection and try again explicitly when ready',
      subscription_sharing_usage_unavailable: 'ChatGPT allowance or account access is currently unavailable',
      context_limit: 'The context budget was reached; reduce unneeded story state before continuing',
      interrupted: 'The server stopped before this reply completed'
    };
    const errorCode = typeof generation.error === 'string' ? generation.error : generation.error?.code || generation.code;
    const safe = explanations[errorCode] || generation.error?.message || 'The reply could not be completed';
    status.append(el('span', '', `Reply ${generation.status}: ${safe}. No incomplete memory changes were applied.`));
    status.append(button('Use last message as draft', 'quiet', () => {
      const lastUser = [...state.story.messages].reverse().find(m => m.role === 'user');
      if (lastUser && (!$('message').value || confirm('Replace your current draft with the previous message?'))) { $('message').value = lastUser.text; saveDraft(); $('message').focus(); }
    }));
  } else if (state.sendRequest) {
    status.append(el('span', '', 'Your last send could not be confirmed. Your draft is preserved.'));
    status.append(button('Resume the same send', 'quiet', () => submitTurn(state.sendRequest)));
  }
}
function sourceButtons(parent, sources) {
  for (const source of sources || []) {
    parent.append(button('↗ Source', 'source-link', () => {
      closeInspector();
      const message = $('message-' + source);
      if (!message) { showNotice('This source message is not available in the displayed transcript.', true); return; }
      message.scrollIntoView({ behavior: 'smooth', block: 'center' }); message.classList.add('flash');
      setTimeout(() => message.classList.remove('flash'), 2500);
    }));
  }
}
function section(title, entries, emptyText, type) {
  const wrapper = el('section', 'state-section'); wrapper.append(el('h3', '', title));
  if (!entries?.length) wrapper.append(el('p', 'empty-state', emptyText));
  for (const entry of entries || []) {
    const item = el('div', 'state-entry');
    const tags = [entry.kind, entry.pinned ? 'Pinned' : '', entry.corrected ? 'Owner corrected' : '', entry.conflict ? 'Conflict to reconcile' : ''].filter(Boolean);
    if (tags.length) item.append(el('p', 'entry-meta', tags.join(' · ')));
    if (entry.status) item.append(el('span', 'status-tag', entry.status));
    item.append(el('p', '', entry.text));
    const actions = el('div', 'entry-actions'); sourceButtons(actions, entry.sources);
    if (type === 'memory') {
      actions.append(button(entry.pinned ? 'Unpin' : 'Pin', 'quiet', () => mutateMemory(entry.id, { pinned: !entry.pinned })), button('Correct', 'quiet', () => editMemory(entry)), button('Remove', 'quiet', () => removeMemory(entry)));
    }
    item.append(actions); wrapper.append(item);
  }
  return wrapper;
}
function renderState() {
  const story = state.story; const content = $('state-content'); content.replaceChildren();
  const scene = el('section', 'state-section'); scene.append(el('h3', '', 'The scene'));
  if (story.scene?.text) {
    const item = el('div', 'state-entry');
    if (story.scene.fictionalTime) item.append(el('p', 'entry-meta', 'Story time · ' + story.scene.fictionalTime));
    item.append(el('p', '', story.scene.text)); const actions = el('div', 'entry-actions'); sourceButtons(actions, story.scene.sources); item.append(actions); scene.append(item);
  } else scene.append(el('p', 'empty-state', 'The scene will take shape as you write.'));
  content.append(scene,
    section('Remembered', story.memories, 'Shared facts and moments will appear here. You can correct, pin, or remove them.', 'memory'),
    section('Unfinished threads', story.threads, 'Promises and plans will stay here until the story resolves them.'),
    section('The relationship', story.relationship, 'Meaningful changes grow from what happens between you.'),
    section('Fictional inner thoughts', story.thoughts, 'Authored character thoughts will appear here. These are part of the fiction, separate from model reasoning.'));
}
async function mutateMemory(id, changes) {
  try { state.story = await api(`/api/stories/${state.story.id}/memories/${id}`, { method: 'PATCH', body: JSON.stringify(changes) }); renderStory(); showNotice('Memory updated.'); }
  catch (error) { showNotice(error.message, true); }
}
function editMemory(entry) {
  state.editingMemory = entry.id; $('memory-text').value = entry.text; $('memory-error').hidden = true;
  $('memory-dialog').showModal(); $('memory-text').focus();
}
async function removeMemory(entry) {
  if (!confirm('Remove this memory? Its source conversation stays in the story; automatic extraction will respect this removal.')) return;
  try { state.story = await api(`/api/stories/${state.story.id}/memories/${entry.id}`, { method: 'DELETE' }); renderStory(); showNotice('Memory removed.'); }
  catch (error) { showNotice(error.message, true); }
}
function closeInspector() {
  $('state-panel').classList.remove('open'); $('state-panel').removeAttribute('role'); $('state-panel').removeAttribute('aria-modal');
  $('inspect-toggle').setAttribute('aria-expanded', 'false');
  for (const element of document.querySelectorAll('.conversation,.story-heading,.masthead')) element.inert = false;
}
function selectOptions(select, values) {
  select.replaceChildren(); const fresh = el('option', '', '+ Create new'); fresh.value = ''; select.append(fresh);
  for (const item of values || []) { const option = el('option', '', item.name); option.value = item.id; select.append(option); }
}
function updateNewFields() {
  for (const kind of ['character', 'persona']) {
    const isNew = !$(kind + '-choice').value;
    $('new-' + kind + '-fields').hidden = !isNew;
    for (const input of $('new-' + kind + '-fields').querySelectorAll('input,textarea')) {
      input.disabled = !isNew; input.required = isNew && input.name !== 'opening';
    }
  }
}
$('login-form').addEventListener('submit', async event => {
  event.preventDefault(); const submit = event.submitter; submit.disabled = true; showNotice('');
  try { await api('/api/login', { method: 'POST', body: JSON.stringify({ password: $('password').value }) }); $('password').value = ''; await initialize(); }
  catch (error) { showNotice(error.message, true); } finally { submit.disabled = false; }
});
$('logout').addEventListener('click', async () => {
  $('logout').disabled = true;
  try { await api('/api/logout', { method: 'POST' }); clearDrafts(); lockView(); showNotice('Notebook locked. Drafts on this device were cleared.'); }
  catch (error) { clearDrafts(); showNotice('Could not confirm server logout. Close this browser and reconnect to lock the server session. Local drafts were cleared. ' + error.message, true); }
  finally { $('logout').disabled = false; }
});
$('back').addEventListener('click', () => { saveDraft(); loadLibrary().catch(error => showNotice(error.message, true)); });
$('new-story').addEventListener('click', () => {
  $('create-form').reset(); $('create-error').hidden = true;
  selectOptions($('character-choice'), state.library.characters); selectOptions($('persona-choice'), state.library.personas);
  updateNewFields(); $('create-dialog').showModal();
});
for (const kind of ['character', 'persona']) $(kind + '-choice').addEventListener('change', updateNewFields);
$('close-create').addEventListener('click', () => $('create-dialog').close());
$('close-memory').addEventListener('click', () => $('memory-dialog').close());
$('create-form').addEventListener('submit', async event => {
  event.preventDefault(); event.submitter.disabled = true; $('create-error').hidden = true;
  const data = new FormData(event.target);
  try {
    let characterId = data.get('characterId'), personaId = data.get('personaId');
    if (!characterId) {
      const character = await api('/api/characters', { method: 'POST', body: JSON.stringify({ name: data.get('characterName').trim(), definition: data.get('characterDefinition').trim(), opening: data.get('opening').trim() }) });
      characterId = character.id; state.library.characters.push(character); selectOptions($('character-choice'), state.library.characters); $('character-choice').value = characterId; updateNewFields();
    }
    if (!personaId) {
      const persona = await api('/api/personas', { method: 'POST', body: JSON.stringify({ name: data.get('personaName').trim(), definition: data.get('personaDefinition').trim() }) });
      personaId = persona.id; state.library.personas.push(persona); selectOptions($('persona-choice'), state.library.personas); $('persona-choice').value = personaId; updateNewFields();
    }
    const story = await api('/api/stories', { method: 'POST', body: JSON.stringify({ characterId, personaId, title: data.get('title').trim() }) });
    $('create-dialog').close(); showNotice(''); await openStory(story.id);
  } catch (error) { $('create-error').textContent = error.message; $('create-error').hidden = false; }
  finally { event.submitter.disabled = false; }
});
$('controls-form').addEventListener('submit', async event => {
  event.preventDefault(); event.submitter.disabled = true;
  try {
    state.story = await api(`/api/stories/${state.story.id}/controls`, { method: 'PATCH', body: JSON.stringify({ tone: $('tone').value, detail: $('detail').value, length: $('length').value }) });
    renderStory(true); showNotice('Writing preferences saved.');
  } catch (error) { showNotice(error.message, true); } finally { event.submitter.disabled = false; }
});
$('message').addEventListener('input', saveDraft);
async function submitTurn(attempt) {
  if (state.busy || isGenerating()) return;
  state.busy = true; renderGeneration(); showNotice('');
  const storyId = state.story.id, { text, requestId } = attempt;
  state.sendRequest = { requestId, text }; saveDraft();
  try {
    await api(`/api/stories/${storyId}/turns`, { method: 'POST', body: JSON.stringify({ requestId, text }) });
    state.sendRequest = null;
    if (state.story?.id === storyId && $('message').value.trim() === text) { $('message').value = ''; saveDraft(); }
    await refreshStory();
  } catch (error) {
    if (error.status) state.sendRequest = null;
    showNotice(error.message + (error.status ? '' : ' Check the transcript before sending another message.'), true);
    schedulePoll(1200);
  } finally { state.busy = false; renderGeneration(); }
}
$('composer').addEventListener('submit', async event => {
  event.preventDefault(); if (state.busy || isGenerating() || !$('message').value.trim()) return;
  if (state.sendRequest) { showNotice('Use “Resume the same send” to check your previous message safely before sending a new one.', true); return; }
  await submitTurn({ text: $('message').value.trim(), requestId: crypto.randomUUID() });
});
$('memory-form').addEventListener('submit', async event => {
  event.preventDefault(); event.submitter.disabled = true; $('memory-error').hidden = true;
  try {
    state.story = await api(`/api/stories/${state.story.id}/memories/${state.editingMemory}`, { method: 'PATCH', body: JSON.stringify({ text: $('memory-text').value.trim() }) });
    renderStory(); $('memory-dialog').close(); showNotice('Correction saved.');
  } catch (error) { $('memory-error').textContent = error.message; $('memory-error').hidden = false; }
  finally { event.submitter.disabled = false; }
});
$('delete-story').addEventListener('click', async () => {
  if (!confirm('Permanently delete this story, its conversation and all its memories? Your character and persona stay in your notebook.')) return;
  try {
    const id = state.story.id; await api(`/api/stories/${id}`, { method: 'DELETE' });
    try { localStorage.removeItem(draftPrefix + id); } catch { /* Storage may be unavailable. */ }
    await loadLibrary(); showNotice('Story deleted.');
  } catch (error) { showNotice(error.message, true); }
});
$('inspect-toggle').addEventListener('click', () => {
  $('state-panel').classList.add('open'); $('state-panel').setAttribute('role', 'dialog'); $('state-panel').setAttribute('aria-modal', 'true');
  $('inspect-toggle').setAttribute('aria-expanded', 'true');
  for (const element of document.querySelectorAll('.conversation,.story-heading,.masthead')) element.inert = true;
  $('inspect-close').focus();
});
$('inspect-close').addEventListener('click', () => { closeInspector(); $('inspect-toggle').focus(); });
$('jump-latest').addEventListener('click', () => { $('composer').scrollIntoView({ behavior: 'smooth', block: 'end' }); $('jump-latest').hidden = true; });
document.addEventListener('keydown', event => {
  if (!$('state-panel').classList.contains('open')) return;
  if (event.key === 'Escape' && !$('memory-dialog').open) { closeInspector(); $('inspect-toggle').focus(); }
  if (event.key === 'Tab' && !$('memory-dialog').open) {
    const focusable = [...$('state-panel').querySelectorAll('button:not(:disabled),a[href],input,textarea,select')].filter(element => element.offsetParent !== null);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
});
window.matchMedia('(min-width: 900px)').addEventListener('change', closeInspector);
document.addEventListener('visibilitychange', () => { if (!document.hidden && state.story) refreshStory(); });
window.addEventListener('online', () => { showNotice('Connection restored. Checking saved story status…'); if (state.story) refreshStory(); });
window.addEventListener('offline', () => showNotice('You are offline. Your draft is kept; reconnect to continue the story.', true));
initialize();
