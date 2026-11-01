'use strict';

const $ = id => document.getElementById(id);
const state = { session: null, sessionEpoch: 0, library: null, story: null, view: 'loading', poll: null, busy: false, editingMemory: null, editingDefinition: null, replacing: null, lastSignature: '', sendRequest: null };
let storyNavigationEpoch=0;
const activeStatuses = new Set(['pending', 'running', 'streaming']);
const draftPrefix = 'storychat:draft:';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}
function contentEl(tag,className,text){const node=el(tag,className,text);node.dataset.content='';return node;}
function button(text, className, onClick) {
  const node = el('button', className, t(text)); node.type = 'button';
  node.addEventListener('click', onClick); return node;
}
const editorDraftMemory=new Map();
function editorDraft(key){const storageKey='storychat:editor:v1:'+key;return {read(){if(editorDraftMemory.has(key))return editorDraftMemory.get(key);try{return JSON.parse(localStorage.getItem(storageKey)||'null');}catch{return null;}},write(value){editorDraftMemory.set(key,value);try{localStorage.setItem(storageKey,JSON.stringify(value));}catch{}},clear(){editorDraftMemory.set(key,null);try{localStorage.removeItem(storageKey);}catch{}}};}
function actionMenu(label,buttons){const details=el('details','action-menu'),summary=el('summary','',t(label));details.append(summary);const list=el('div','action-menu-list');list.append(...buttons);details.append(list);list.addEventListener('click',event=>{if(event.target.closest('button')){details.open=false;if(list.contains(document.activeElement))summary.focus();}});details.addEventListener('keydown',event=>{if(event.key==='Escape'){details.open=false;summary.focus();}});return details;}
let dialogSequence=0;
function nameDialog(dialog,heading){if(!heading.id)heading.id='dialog-heading-'+(++dialogSequence);dialog.setAttribute('aria-labelledby',heading.id);}
window.StoryUX={actionMenu,draft:editorDraft,nameDialog};
let restoringReading=false,leavingReading=false;
if('scrollRestoration' in history)history.scrollRestoration='manual';
function saveReading(){if(restoringReading||leavingReading||state.view!=='story-view'||!state.story)return;const visible=[...document.querySelectorAll('#messages .message')].find(n=>{const r=n.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight;});if(!visible)return;const value={messageId:visible.id,offset:visible.getBoundingClientRect().top,following:innerHeight+scrollY>=document.documentElement.scrollHeight-160};editorDraft('reading:'+state.story.id).write(value);}
function scrollToLatest(behavior='auto'){window.scrollTo({top:document.documentElement.scrollHeight,behavior});$('jump-latest').hidden=true;}
function restoreReading(id){const saved=editorDraft('reading:'+id).read();restoringReading=true;requestAnimationFrame(()=>requestAnimationFrame(()=>{const target=saved?.messageId&&$(saved.messageId);if(state.view==='story-view'&&state.story?.id===id){if(saved?.following||!saved)scrollToLatest();else if(target)window.scrollBy(0,target.getBoundingClientRect().top-saved.offset);}restoringReading=false;}));}
function showNotice(message, error = false) {
  $('notice').textContent = t(message); $('notice').classList.toggle('error', error); $('notice').hidden = !message;
}
function view(name) {
  const previousView=state.view;
  if(name!=='story-view')storyNavigationEpoch++;
  if(state.view==='story-view'&&name!=='story-view')saveDraft();
  state.view = name;
  $('app-nav').hidden = !state.session?.authenticated;
  for (const id of ['loading', 'login-view', 'library-view', 'story-view', 'characters-view', 'character-view', 'personas-view', 'persona-view', 'settings-view']) $(id).hidden = id !== name;
  $('page-footer').hidden = name === 'story-view';
  const heading=$(name)?.querySelector('h1,h2');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
  document.body.classList.toggle('reading-story',name==='story-view');
  if(name!=='story-view'){if(previousView!==name)window.scrollTo(0,0);leavingReading=false;}
  for(const nav of $('app-nav').querySelectorAll('button')){const active=nav.id==='nav-'+(name.includes('persona')?'personas':name.includes('character')?'characters':name==='settings-view'?'settings':'stories');if(active)nav.setAttribute('aria-current','page');else nav.removeAttribute('aria-current');}
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
    const errorMessages={sign_in_required:'Connect ChatGPT with the local onboarding helper on the server first',provider_unavailable:'Check the protected ChatGPT runtime and complete sign-in if needed',model_unavailable:'Select an available model from the authorized catalog in server configuration',subscription_sharing_usage_unavailable:'ChatGPT allowance or account access is currently unavailable',context_limit:'The context budget was reached; reduce unneeded story state before continuing',invalid:'Check the supplied fields and try again.',unauthorized:'Open the notebook to continue.',not_found:'This record is no longer available.',conflict:'This record changed. Refresh before trying again.',too_large:'This file is too large.',media_invalid:'This image format could not be read.',media_quota:'Media storage is full.'};
    const error = new Error(t(errorMessages[value.error?.code] || 'This action could not be completed.'));
    error.code = value.error?.code; error.status = response.status; throw error;
  }
  if (epoch !== state.sessionEpoch) throw new Error('The notebook was locked. Open it again to continue.');
  return value;
}
function stopPolling() { clearTimeout(state.poll); state.poll = null; }
function lockView() {
  state.sessionEpoch += 1;
  stopPolling(); unconfirmedThought=null; state.session = null; state.story = null; state.library = null; state.sendRequest = null;
  $('messages').replaceChildren(); $('state-content').replaceChildren(); $('story-list').replaceChildren();$('character-grid').replaceChildren();$('character-detail').replaceChildren();$('definition-form').reset();
  if(typeof clearPersonaView==='function')clearPersonaView();
  $('message').value = ''; $('password').value = ''; $('logout').hidden = true; $('provider-badge').hidden = true;
  closeInspector();
  for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
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
    if(document.readyState==='loading')await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
    if(typeof routeCurrentHash==='function')routeCurrentHash();
  } catch (error) { lockView(); showNotice(error.message, true); }
}
async function loadLibrary() {
  saveDraft();storyNavigationEpoch++;stopPolling(); closeInspector();
  const navigation=storyNavigationEpoch,epoch=state.sessionEpoch;const library=await api('/api/library?summary=true');if(navigation!==storyNavigationEpoch||epoch!==state.sessionEpoch)return;state.library=library;state.story=null; state.lastSignature = '';
  renderLibrary(); view('library-view');
}
function renderLibrary() {
  $('story-list').replaceChildren();
  const q=($('story-search')?.value||'').trim().toLocaleLowerCase();const stories=[...(state.library.stories||[])].filter(story=>[story.title,story.character?.name,story.persona?.name,story.lastMessage].join(' ').toLocaleLowerCase().includes(q)).sort((a,b)=>(b.lastActivity||'').localeCompare(a.lastActivity||''));
  if(!stories.length&&q){$('story-list').append(el('p','empty-state',t('No stories match your search.')));return;}
  if (!stories.length) {
    const empty = el('div', 'empty-notebook');
    empty.append(el('span', '', '✦'), el('h2', '', 'An unwritten world.'), el('p', '', 'Begin with a character and a place. The memories will grow from the moments you share.'));
    $('story-list').append(empty); return;
  }
  for (const story of stories) {
    const characterName = story.character?.name || state.library.characters?.find(c => c.id === story.characterId)?.name || 'Your character';
    const card = button('', 'story-card', () => openStory(story.id).catch(error => showNotice(error.message, true)));
    const bottom = el('div', 'card-bottom'); bottom.append(el('span', '', 'Continue the story'), el('span', '', '↗'));
    card.append(el('div', 'card-monogram', Array.from(characterName)[0]?.toUpperCase() || '✦'), contentEl('h2', '', story.title || t('Untitled story')), contentEl('p', '', (uiLocale==='de'?'Mit ':'With ') + characterName), bottom);
    if(story.persona?.name)card.insertBefore(contentEl('p','story-persona',story.persona.name),bottom);if(story.lastMessage)card.insertBefore(contentEl('p','story-preview',story.lastMessage),bottom);
    $('story-list').append(card);
  }
}
async function openStory(id,options={}) {
  const route='#story/'+encodeURIComponent(id);if(!options.fromRoute&&location.hash!==route){saveDraft();location.hash=route;return;}
  const navigation=++storyNavigationEpoch;saveDraft();
  stopPolling(); state.lastSignature = ''; state.sendRequest = null;
  const opened=await api('/api/stories/'+encodeURIComponent(id));if(navigation!==storyNavigationEpoch||!state.session?.authenticated)return;state.story=opened;
  renderStory(true); restoreDraft(id); view('story-view');
  restoreReading(id);
  schedulePoll();
}
function lastGeneration() { return state.story?.generations?.filter(g => g.status !== 'superseded').at(-1); }
function isGenerating() { return state.story?.generations?.some(g => activeStatuses.has(g.status)) || state.story?.thoughtRequests?.some(g=>g.status==='pending'); }
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
  const followingLatest = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 260;
  const previousStatus = $('generation-status').textContent;
  const navigationEpoch = storyNavigationEpoch;
  let appendedMessages = false;
  $('story-title').textContent = story.title;
  $('story-kicker').textContent = (uiLocale==='de'?'MIT ':'WITH ') + (story.character?.name || t('Your character'));
  if(unconfirmedThought&&state.story?.thoughtRequests?.some(r=>r.requestId===unconfirmedThought.requestId))unconfirmedThought=null;
  const signature = JSON.stringify({ revision: story.revision, messages: story.messages, memories: story.memories, threads: story.threads, thoughts: story.thoughts, relationship: story.relationship, scene: story.scene, generations: story.generations, thoughtRequests:story.thoughtRequests });
  if (force || signature !== state.lastSignature) {
    const nearBottom = followingLatest;
    const previousCount = $('messages').children.length;
    const focused=document.activeElement,focusId=focused?.closest('.message')?.id,focusText=focused?.textContent,stateFocus=$('state-content').contains(focused)?[...$('state-content').querySelectorAll('button')].indexOf(focused):-1;const priorAnchor=[...$('messages').children].find(n=>n.getBoundingClientRect().bottom>0),priorTop=priorAnchor?.getBoundingClientRect().top,priorId=priorAnchor?.id;
    renderMessages(); renderState(); state.lastSignature = signature;
    if(focusId){const same=[...($(focusId)?.querySelectorAll('button,summary')||[])].find(n=>n.textContent===focusText);if(same){const disclosure=same.closest('details');if(disclosure)disclosure.open=true;same.focus({preventScroll:true});}}
    if(stateFocus>=0){const candidate=$('state-content').querySelectorAll('button')[stateFocus];if(candidate?.textContent===focusText)candidate.focus({preventScroll:true});else if($('state-panel').classList.contains('open'))$('inspect-close').focus({preventScroll:true});}
    if(!nearBottom&&priorId&&$(priorId))window.scrollBy(0,$(priorId).getBoundingClientRect().top-priorTop);
    if ($('messages').children.length > previousCount && !force) {
      appendedMessages = true;
      if (!nearBottom) $('jump-latest').hidden = false;
    }
  }
  const controls = story.controls || { tone: 'Natural', detail: 'balanced', length: 'medium' };
  // Do not replace an in-progress preference selection while the owner is editing it.
  if (!$('controls-form').contains(document.activeElement) || force) {
    $('tone').value = controls.tone; $('detail').value = controls.detail; $('length').value = controls.length;
  }
  $('control-summary').textContent = [controls.tone,controls.detail,controls.length].map(value=>t(value[0].toUpperCase()+value.slice(1))).join(' · ');
  renderGeneration(); renderThoughtControls();
  // Status can grow without another message (for example pending -> failed).
  // Follow only readers who were already at the latest turn, after all layout changes.
  if (!force && followingLatest && (appendedMessages || previousStatus !== $('generation-status').textContent)) {
    requestAnimationFrame(() => {
      if (state.view === 'story-view' && state.story?.id === story.id && storyNavigationEpoch === navigationEpoch) scrollToLatest();
    });
  }
}
function renderMessages() {
  $('messages').replaceChildren();
  for (const message of (state.story.messages || []).filter(item => !item.superseded)) {
    const article = el('article', 'message' + (message.kind==='thought'?' thought':'') + (message.role === 'user' ? ' user' : message.kind === 'intro' || message.type === 'intro' ? ' intro' : ''));
    article.id = 'message-' + message.id;
    article.append(contentEl('p', 'message-label', message.kind==='thought'?t('Inner thought'): message.kind === 'intro' || message.type === 'intro' ? t('Intro') : message.role === 'user' ? (state.story.persona?.name || t('You')) : state.story.character?.name || t('Character')), StoryNarration.render(contentEl('div', 'message-text'), message.text));
    if(message.kind==='thought'){const actions=el('div','thought-actions');actions.append(button('Replace thought','quiet',()=>generateThought(message.id)),button('Delete thought','quiet',()=>deleteThought(message.id)));sourceButtons(actions,message.sources);const menu=actionMenu('Thought actions',[...actions.children]);menu.querySelector('summary').setAttribute('aria-label',t('Thought actions')+': '+message.text.slice(0,60));article.append(menu);}
    $('messages').append(article);
  }
  if (!$('messages').children.length) $('messages').append(el('p', 'empty-state', 'The scene is yours to begin. Write the first moment below.'));
}
function renderGeneration() {
  const status = $('generation-status'); status.replaceChildren(); status.classList.remove('error');
  const generation = lastGeneration(); const pending = state.story?.generations?.some(g=>activeStatuses.has(g.status));
  $('send').disabled = state.busy || isGenerating();
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
    const safe = t(explanations[errorCode] || 'The reply could not be completed');
    status.append(el('span', '', uiLocale==='de'?`Antwort ${t(generation.status)}: ${safe}. Es wurden keine unvollständigen Erinnerungen übernommen.`:`Reply ${generation.status}: ${safe}. No incomplete memory changes were applied.`));
    status.append(button('Use last message as draft', 'quiet', () => {
      const lastUser = [...state.story.messages].reverse().find(m => m.role === 'user');
      if (lastUser && (!$('message').value || uiConfirm('Replace your current draft with the previous message?'))) { $('message').value = lastUser.text; saveDraft(); $('message').focus(); }
    }));
  } else if (state.sendRequest) {
    status.append(el('span', '', 'Your last send could not be confirmed. Your draft is preserved.'));
    status.append(button('Resume the same send', 'quiet', () => submitTurn(state.sendRequest)));
  }
  if (!pending && !state.busy && !state.sendRequest && generation && generation.status !== 'superseded') {
    status.append(button('Edit latest message', 'quiet', () => openReplacement(generation)), button('Regenerate reply', 'quiet', () => regenerate(generation)));
  }
}
function sourceButtons(parent, sources) {
  for (const source of sources || []) {
    const sourceButton=button('↗ Source','source-link',()=>{
      const fromMemory=$('state-panel').classList.contains('open')||$('state-panel').contains(document.activeElement);closeInspector();
      const message = $('message-' + source);
      if (!message) {
        const audit = state.story.messages?.find(item => item.id === source && item.superseded);
        if (audit) {
          const dialog = document.createElement('dialog'), content = el('section','create-form');
          content.append(el('h2','','Earlier source'),el('p','hint','This message belongs to a replaced turn. It is retained as source evidence, not current story context.'),contentEl('p','message-text',audit.text),button('Close','quiet',()=>dialog.close()));
          dialog.append(content);nameDialog(dialog,content.querySelector('h2'));document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
        } else showNotice('This source message is not available in the displayed transcript.', true);
        return;
      }
      message.tabIndex=-1;message.focus({preventScroll:true});message.scrollIntoView({behavior:'smooth',block:'center'});message.classList.add('flash');if(fromMemory){let back=$('return-memory');if(!back){back=button('Back to story memory','source-return',()=>{$('inspect-toggle').click();});back.id='return-memory';$('story-view').append(back);}back.hidden=false;}
      setTimeout(() => message.classList.remove('flash'), 2500);
    });sourceButton.setAttribute('aria-label',t('View source message')+' '+String(source).slice(0,8));parent.append(sourceButton);
  }
}
function section(title, entries, emptyText, type) {
  const wrapper = el('section', 'state-section'); wrapper.append(el('h3', '', title));
  if (!entries?.length) wrapper.append(el('p', 'empty-state', emptyText));
  for (const entry of entries || []) {
    const item = el('div', 'state-entry');
    const tags = [entry.kind, entry.pinned ? 'Pinned' : '', entry.corrected ? 'Owner corrected' : '', entry.conflict ? 'Conflict to reconcile' : ''].filter(Boolean);
    if (tags.length) item.append(el('p', 'entry-meta', tags.map(t).join(' · ')));
    if (entry.status) item.append(el('span', 'status-tag', entry.status));
    item.append(contentEl('p', '', entry.text));
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
    item.append(contentEl('p', '', story.scene.text)); const actions = el('div', 'entry-actions'); sourceButtons(actions, story.scene.sources); item.append(actions); scene.append(item);
  } else scene.append(el('p', 'empty-state', 'The scene will take shape as you write.'));
  content.append(scene,
    section('Remembered', story.memories, 'Shared facts and moments will appear here. You can correct, pin, or remove them.', 'memory'),
    section('Unfinished threads', story.threads, 'Promises and plans will stay here until the story resolves them.'),
    section('The relationship', story.relationship, 'Meaningful changes grow from what happens between you.'),
    section('Fictional inner thoughts', [...(story.thoughts||[]),...story.messages.filter(m=>m.kind==='thought'&&!m.superseded).slice(-8).map(m=>({...m,key:m.id}))], 'Authored character thoughts will appear here. These are part of the fiction, separate from model reasoning.'));
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
  if (!uiConfirm('Remove this memory? Its source conversation stays in the story; automatic extraction will respect this removal.')) return;
  try { state.story = await api(`/api/stories/${state.story.id}/memories/${entry.id}`, { method: 'DELETE' }); renderStory(); showNotice('Memory removed.'); }
  catch (error) { showNotice(error.message, true); }
}
function closeInspector() {
  $('state-panel').classList.remove('open'); $('state-panel').removeAttribute('role'); $('state-panel').removeAttribute('aria-modal');
  $('inspect-toggle').setAttribute('aria-expanded', 'false');
  for (const element of document.querySelectorAll('.conversation,.story-heading,.masthead,#app-nav')) element.inert = false;
}
function selectOptions(select, values) {
  select.replaceChildren(); const fresh = el('option', '', '+ Create new'); fresh.value = ''; select.append(fresh);
  for (const item of (values || []).filter(value => !value.archived)) { const option = contentEl('option', '', item.name); option.value = item.id; select.append(option); }
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
$('back').addEventListener('click',()=>{saveDraft();location.hash='stories';});
let createEpoch=0;
$('new-story').addEventListener('click', () => {
  createEpoch++;
  $('create-form').reset(); $('create-error').hidden = true;
  selectOptions($('character-choice'), state.library.characters.filter(c=>!c.draft)); selectOptions($('persona-choice'), state.library.personas);
  restoreNewStoryDraft();updateNewFields(); $('create-dialog').showModal();
});
for (const kind of ['character', 'persona']) $(kind + '-choice').addEventListener('change', updateNewFields);
$('close-create').addEventListener('click', () => $('create-dialog').close());
$('close-memory').addEventListener('click', () => $('memory-dialog').close());
$('create-form').addEventListener('submit', async event => {
  event.preventDefault(); event.submitter.disabled = true; $('create-error').hidden = true;
  const data = new FormData(event.target),epoch=createEpoch,sessionEpoch=state.sessionEpoch;const current=()=>epoch===createEpoch&&sessionEpoch===state.sessionEpoch&&$('create-dialog').open;
  try {
    let characterId = data.get('characterId'), personaId = data.get('personaId');
    if (!characterId) {
      const character = await api('/api/characters', { method: 'POST', body: JSON.stringify({ name: data.get('characterName').trim(), definition: data.get('characterDefinition').trim(), opening: data.get('opening').trim() }) });
      if(!current())return;characterId = character.id; state.library.characters.push(character); selectOptions($('character-choice'), state.library.characters); $('character-choice').value = characterId; updateNewFields();
    }
    if (!personaId) {
      const persona = await api('/api/personas', { method: 'POST', body: JSON.stringify({ name: data.get('personaName').trim(), definition: data.get('personaDefinition').trim() }) });
      if(!current())return;personaId = persona.id; state.library.personas.push(persona); selectOptions($('persona-choice'), state.library.personas); $('persona-choice').value = personaId; updateNewFields();
    }
    const story = await api('/api/stories', { method: 'POST', body: JSON.stringify({ characterId, personaId, title: data.get('title').trim() }) });
    if(!current())return;editorDraft('new-story').clear();$('create-dialog').dataset.saved='true';$('create-dialog').close();showNotice('');await openStory(story.id);
  } catch (error) {if(!current())return;saveNewStoryDraft();$('create-error').textContent = t('Any character or persona already created remains in your library. Your draft is preserved.')+' '+error.message; $('create-error').hidden = false; }
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
  if (!uiConfirm('Permanently delete this story, its conversation and all its memories? Your character and persona stay in your notebook.')) return;
  try {
    const id = state.story.id; await api(`/api/stories/${id}`, { method: 'DELETE' });
    try { localStorage.removeItem(draftPrefix + id); } catch { /* Storage may be unavailable. */ }
    await loadLibrary(); showNotice('Story deleted.');
  } catch (error) { showNotice(error.message, true); }
});
$('inspect-toggle').addEventListener('click', () => {
  $('state-panel').classList.add('open'); $('state-panel').setAttribute('role', 'dialog'); $('state-panel').setAttribute('aria-modal', 'true');
  $('inspect-toggle').setAttribute('aria-expanded', 'true');
  for (const element of document.querySelectorAll('.conversation,.story-heading,.masthead,#app-nav')) element.inert = true;
  $('inspect-close').focus();
});
$('inspect-close').addEventListener('click', () => { closeInspector(); $('inspect-toggle').focus(); });
$('jump-latest').addEventListener('click', () => { scrollToLatest('smooth'); });
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
document.addEventListener('visibilitychange', () => { if (document.hidden) { saveDraft(); stopPolling(); } else if (state.story) refreshStory(); });
window.addEventListener('pagehide', saveDraft);
window.addEventListener('online', () => { showNotice('Connection restored. Checking saved story status…'); if (state.story) refreshStory(); });
window.addEventListener('offline', () => showNotice('You are offline. Your draft is kept; reconnect to continue the story.', true));
initialize();

// Library controls use textContent throughout: imported definitions are untrusted text.
async function libraryAction(kind, record, action) {
  if (action === 'delete' && !confirm('Delete this library definition? Existing story snapshots remain unchanged.')) return;
  try {
    const path = `/api/${kind}/${encodeURIComponent(record.id)}`;
    if (action === 'duplicate') await api(path + '/duplicate', {method:'POST',body:'{}'});
    else if (action === 'delete') await api(path, {method:'DELETE'});
    else await api(path, {method:'PATCH',body:JSON.stringify({archived:!record.archived})});
    state.library = await api('/api/library?summary=true'); renderDefinitions(); renderLibrary(); showNotice('Library updated.');
  } catch(error) { showNotice(error.message,true); }
}
function renderDefinitions() {
  const list=$('definition-list'); list.replaceChildren();
  for (const [kind,title] of [['characters','Characters'],['personas','Personas']]) {
    const section=el('section','definition-section'); section.append(el('h3','',title));
    for(let record of state.library[kind] || []) {
      const row=el('article','definition-row'); row.append(contentEl('h3','',record.name + (record.archived?' · '+t('Archived'):'')),el('p','hint',`Version ${record.version || 1}`));
      const actions=el('div','entry-actions');
      actions.append(button('Edit','quiet',async()=>{
        try{record=await api('/api/'+kind+'/'+encodeURIComponent(record.id));}catch(error){showNotice(error.message,true);return;}
        if(kind==='personas'){ $('library-dialog').close(); editPersona(record); return; }
        state.editingDefinition={kind,id:record.id}; $('definition-name').value=record.name; $('definition-text').value=record.definition;
        fillCharacterFields(record,kind); $('definition-opening').value=record.opening||''; $('definition-opening-label').hidden=kind!=='characters'; $('definition-error').hidden=true; $('definition-dialog').showModal();
      }),button('Duplicate','quiet',()=>libraryAction(kind,record,'duplicate')),button(record.archived?'Unarchive':'Archive','quiet',()=>libraryAction(kind,record,'archive')),button('Delete','danger',()=>libraryAction(kind,record,'delete')));
      row.append(actions);section.append(row);
    }
    if(!(state.library[kind]||[]).length)section.append(el('p','hint','Create one when beginning a story.'));
    list.append(section);
  }
}
$('manage-library').addEventListener('click',()=>{location.hash='characters';});
$('close-library').addEventListener('click',()=>$('library-dialog').close());
$('close-definition').addEventListener('click',()=>$('definition-dialog').close());
$('definition-form').addEventListener('submit',async event=>{
  event.preventDefault();event.submitter.disabled=true;const definitionEpoch=typeof characterEditEpoch==='number'?characterEditEpoch:0,sessionEpoch=state.sessionEpoch;
  try {
    const {kind,id}=state.editingDefinition, changes={name:$('definition-name').value.trim(),definition:$('definition-text').value.trim()};
    if(kind==='characters')Object.assign(changes, readCharacterFields(), {opening:$('definition-opening').value.trim()});
    const saved=await api(`/api/${kind}${id ? '/' + encodeURIComponent(id) : ''}`,{method:id?'PATCH':'POST',body:JSON.stringify(changes)});if(sessionEpoch!==state.sessionEpoch||!$('definition-dialog').open||state.editingDefinition?.id!==id||(typeof characterEditEpoch==='number'&&characterEditEpoch!==definitionEpoch))return;document.dispatchEvent(new CustomEvent('definition-saved',{detail:{kind,id,savedId:saved.id}}));
    state.library=await api('/api/library?summary=true');renderDefinitions();$('definition-dialog').close();if(state.view==='characters-view'||state.view==='character-view')await loadCharacters();showNotice('Definition saved. Existing stories retain their snapshots.');
  }catch(error){$('definition-error').textContent=error.message;$('definition-error').hidden=false;}finally{event.submitter.disabled=false;}
});
function openReplacement(generation) {
  const message=state.story.messages.find(item=>item.id===generation.userMessageId);if(!message)return;
  state.replacing={generationId:generation.id,revision:state.story.revision};$('replace-text').value=message.text;$('replace-error').hidden=true;$('replace-dialog').showModal();
}
async function replaceTurn(attempt) {
  if(state.busy || isGenerating())return;
  state.busy=true; renderGeneration();
  try {await api(`/api/stories/${state.story.id}/turns/replace`,{method:'POST',body:JSON.stringify(attempt)});await refreshStory();showNotice('Replacement started. Check the saved status before requesting another reply.');}
  catch(error){showNotice(error.message+' Check the saved transcript before requesting another replacement.',true);schedulePoll(1000);throw error;}
  finally{state.busy=false;renderGeneration();}
}
async function regenerate(generation) {
  if(!uiConfirm('Replace the latest reply and its derived state? This sends one new request using your ChatGPT allowance.'))return;
  try{await replaceTurn({requestId:crypto.randomUUID(),generationId:generation.id,revision:state.story.revision});}catch{}
}
$('close-replace').addEventListener('click',()=>$('replace-dialog').close());
$('replace-form').addEventListener('submit',async event=>{
  event.preventDefault();event.submitter.disabled=true;
  try{await replaceTurn({...state.replacing,requestId:crypto.randomUUID(),text:$('replace-text').value.trim()});$('replace-dialog').close();}
  catch(error){$('replace-error').textContent=error.message;$('replace-error').hidden=false;}finally{event.submitter.disabled=false;}
});
$('export-data').addEventListener('click',async()=>{
  try{const archive=await api('/api/export');const url=URL.createObjectURL(new Blob([JSON.stringify(archive,null,2)],{type:'application/json'}));const link=el('a');link.href=url;link.download='storychat-notebook-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);showNotice('Portable export downloaded. It contains private story text but excludes replacement history and provider credentials. Use a database backup for full recovery.');}catch(error){showNotice(error.message,true);}
});
$('import-data').addEventListener('click',()=>$('import-file').click());
$('import-file').addEventListener('change',async event=>{
  const file=event.target.files[0];event.target.value='';if(!file)return;
  let limits;try{limits=await api('/api/transfer-limits');}catch(error){showNotice(error.message,true);return;}const maximum=limits.notebookBytes;if(!Number.isSafeInteger(maximum)||file.size>maximum){showNotice('This file is too large.',true);return;}
  if(!uiConfirm('Import this notebook as additional records? The file may contain private story text. Existing records will remain.'))return;
  try{const archive=JSON.parse(await file.text());await api('/api/import',{method:'POST',body:JSON.stringify(archive)});await loadLibrary();showNotice('Notebook imported. No model requests were sent.');}catch(error){showNotice(error.message,true);}
});
let installPrompt=null;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;$('install-now').hidden=false;});
$('install-help').addEventListener('click',()=>$('install-dialog').showModal());
$('close-install').addEventListener('click',()=>$('install-dialog').close());
$('install-now').addEventListener('click',async()=>{if(!installPrompt)return;await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('install-now').hidden=true;});
window.visualViewport?.addEventListener('resize',()=>{document.documentElement.style.setProperty('--visible-height',window.visualViewport.height+'px');});

StoryNarration.attach($('message'),$('mark-narration'),()=>showNotice('Not enough space to add narration markers.',true));
StoryNarration.attach($('replace-text'),$('mark-replacement-narration'),()=>showNotice('Not enough space to add narration markers.',true));

// Reading preferences never enter story/provider state.
const chatSizes=[85,100,115,130,150],chatSizeKey='storychat.chatTextSize.v1';let chatSize=100;
try{const saved=Number(localStorage.getItem(chatSizeKey));if(chatSizes.includes(saved))chatSize=saved;}catch{}
const reading=el('section','reading-controls'),readingTitle=el('h2','',t('Chat text size')),readingButtons=el('div','reading-buttons'),sizeLabel=el('span');sizeLabel.setAttribute('role','status');
const smaller=button('Decrease text size','quiet',()=>setChatSize(chatSizes[Math.max(0,chatSizes.indexOf(chatSize)-1)])),larger=button('Increase text size','quiet',()=>setChatSize(chatSizes[Math.min(chatSizes.length-1,chatSizes.indexOf(chatSize)+1)])),resetSize=button('Reset to default','quiet',()=>setChatSize(100));
readingButtons.append(smaller,sizeLabel,larger,resetSize);reading.append(readingTitle,readingButtons);$('settings-tools').append(reading);
function setChatSize(value){const following=innerHeight+scrollY>=document.documentElement.scrollHeight-100;const anchor=[...document.querySelectorAll('#messages .message')].find(n=>n.getBoundingClientRect().bottom>0),top=anchor?.getBoundingClientRect().top;chatSize=value;try{localStorage.setItem(chatSizeKey,String(value));}catch{}applyChatSize();requestAnimationFrame(()=>{if(state.view!=='story-view')return;if(following)window.scrollTo(0,document.documentElement.scrollHeight);else if(anchor?.isConnected)window.scrollBy(0,anchor.getBoundingClientRect().top-top);});}
function applyChatSize(){document.documentElement.style.setProperty('--chat-text-scale',String(chatSize/100));sizeLabel.textContent=chatSize+'%';smaller.disabled=chatSize===85;larger.disabled=chatSize===150;}applyChatSize();
const thoughtBar=el('section','thought-controls'),thoughtGenerate=button('Generate inner thought','quiet',()=>generateThought()),thoughtStatus=el('p','hint'),thoughtCancel=button('Cancel thought generation','quiet',()=>cancelThought());thoughtStatus.setAttribute('role','status');const thoughtCheck=button('Check thought status','quiet',async()=>{try{const checkId=state.story?.id;await refreshStory();if(state.story?.id!==checkId||unconfirmedThought?.storyId!==checkId)return;if(unconfirmedThought&&!state.story?.thoughtRequests?.some(r=>r.requestId===unconfirmedThought.requestId))unconfirmedThought=null;renderThoughtControls();}catch(e){showNotice(e.message,true);}});thoughtBar.append(actionMenu('Story actions',[thoughtGenerate,el('p','hint',t('One fictional thought using your ChatGPT allowance. It is not spoken dialogue.'))]),thoughtCheck,thoughtStatus,thoughtCancel);$('composer').before(thoughtBar);
let thoughtActionBusy=false,unconfirmedThought=null;
function unknownThoughtHere(){return !!unconfirmedThought&&unconfirmedThought.storyId===state.story?.id;}
function renderThoughtControls(){const pending=state.story?.thoughtRequests?.find(r=>r.status==='pending'),last=state.story?.thoughtRequests?.at(-1);thoughtGenerate.disabled=state.busy||isGenerating()||thoughtActionBusy||unknownThoughtHere();thoughtCheck.hidden=!unknownThoughtHere();thoughtCancel.hidden=!pending;thoughtCancel.disabled=thoughtActionBusy;thoughtStatus.textContent=pending?t('Writing a fictional thought…'):unknownThoughtHere()?t('Thought request could not be confirmed. Check saved status before trying again.'):last&&['failed','interrupted','cancelled'].includes(last.status)?t('Thought generation did not complete. No partial thought was added.') : '';for(const n of document.querySelectorAll('.thought-actions button'))n.disabled=state.busy||isGenerating()||thoughtActionBusy||unknownThoughtHere();}
async function generateThought(replaceId){if(state.busy||isGenerating()||thoughtActionBusy||unknownThoughtHere())return;const id=state.story.id,epoch=state.sessionEpoch,requestId=crypto.randomUUID();thoughtActionBusy=true;renderThoughtControls();try{await api('/api/stories/'+id+'/thoughts',{method:'POST',body:JSON.stringify({requestId,...(replaceId?{replaceId}:{})})});if(epoch!==state.sessionEpoch||state.story?.id!==id)return;unconfirmedThought=null;await refreshStory();schedulePoll(500);}catch(e){if(epoch===state.sessionEpoch&&state.story?.id===id){unconfirmedThought={storyId:id,requestId};showNotice(e.message,true);schedulePoll(500);}}finally{thoughtActionBusy=false;renderThoughtControls();}}
async function cancelThought(){const storyId=state.story?.id,epoch=state.sessionEpoch;const r=state.story?.thoughtRequests?.find(r=>r.status==='pending');if(!r)return;thoughtActionBusy=true;try{const updated=await api('/api/stories/'+storyId+'/thoughts/cancel',{method:'POST',body:JSON.stringify({requestId:r.requestId})});if(epoch!==state.sessionEpoch||state.story?.id!==storyId)return;state.story=updated;renderStory(true);}catch(e){showNotice(e.message,true);}finally{thoughtActionBusy=false;renderThoughtControls();}}
async function deleteThought(id){const storyId=state.story?.id,epoch=state.sessionEpoch;if(isGenerating()||!uiConfirm('Delete this fictional thought? It will no longer guide future replies.'))return;try{const updated=await api('/api/stories/'+storyId+'/thoughts/'+id,{method:'DELETE'});if(epoch!==state.sessionEpoch||state.story?.id!==storyId)return;state.story=updated;renderStory(true);}catch(e){showNotice(e.message,true);}}

function saveNewStoryDraft(){if($('create-dialog').dataset.saved==='true')return;editorDraft('new-story').write(Object.fromEntries([...$('create-form').elements].filter(n=>n.name).map(n=>[n.name,n.value])));}
function restoreNewStoryDraft(){$('create-dialog').dataset.saved='';const saved=editorDraft('new-story').read();if(saved){for(const [key,value]of Object.entries(saved)){const field=$('create-form').elements.namedItem(key);if(field&&typeof value==='string')field.value=value;}showNotice('Your saved draft is ready.');}}
$('create-form').addEventListener('input',saveNewStoryDraft);$('create-form').addEventListener('change',saveNewStoryDraft);$('create-dialog').addEventListener('close',()=>{saveNewStoryDraft();createEpoch++;});$('create-dialog').addEventListener('cancel',saveNewStoryDraft);
const discardNew=button('Discard draft','quiet',()=>{if(!uiConfirm('Discard this saved draft?'))return;editorDraft('new-story').clear();$('create-form').reset();updateNewFields();$('create-dialog').dataset.saved='';});$('create-form').append(discardNew);
const storySearch=el('input');storySearch.id='story-search';storySearch.type='search';storySearch.placeholder=t('Search stories');storySearch.setAttribute('aria-label',t('Search stories'));storySearch.addEventListener('input',renderLibrary);$('story-list').before(storySearch);
const chatReading=el('details','chat-reading'),chatReadingLabel=el('summary','',t('Reading preferences')),chatReadingButtons=el('div','reading-buttons');chatReadingButtons.append(button('Decrease text size','quiet',()=>setChatSize(chatSizes[Math.max(0,chatSizes.indexOf(chatSize)-1)])),button('Increase text size','quiet',()=>setChatSize(chatSizes[Math.min(chatSizes.length-1,chatSizes.indexOf(chatSize)+1)])),button('Reset to default','quiet',()=>setChatSize(100)));chatReading.append(chatReadingLabel,chatReadingButtons);$('messages').before(chatReading);
for(const dialog of document.querySelectorAll('dialog')){const heading=dialog.querySelector('h1,h2,h3');if(heading)nameDialog(dialog,heading);}
window.addEventListener('pagehide',()=>{saveReading();if($('create-dialog').open)saveNewStoryDraft();});
let readingSaveTimer;window.addEventListener('scroll',()=>{clearTimeout(readingSaveTimer);readingSaveTimer=setTimeout(saveReading,250);},{passive:true});

function groupSettings(){const deviceSection=el('section','settings-group'),backupSection=el('section','settings-group');deviceSection.append(el('h2','',t('Device')),$('install-help'));backupSection.append(el('h2','',t('Backup and transfer')),$('export-data'),$('import-data'));$('settings-tools').append(deviceSection,backupSection);$('manage-library').hidden=true;}
if(document.readyState!=='complete')document.addEventListener('DOMContentLoaded',groupSettings,{once:true});else groupSettings();

// Navigation may trigger browser hash scrolling before asynchronous route work.
// Preserve the last continuously recorded reading anchor through that transition.
$('app-nav').addEventListener('click',()=>{if(state.view==='story-view'){leavingReading=true;clearTimeout(readingSaveTimer);}},{capture:true});
$('back').addEventListener('click',()=>{leavingReading=true;clearTimeout(readingSaveTimer);},{capture:true});
