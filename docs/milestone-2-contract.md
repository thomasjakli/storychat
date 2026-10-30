# Milestone 2 implementation contract

Coordinator decision, 2026-10-30: Node 24, built-in SQLite, a buildless original browser UI, and one local server. No dependencies, paid services, or external deployment changes. These are implementation choices, not new owner requirements.

## Store contract (`app/store.mjs`)

Export `Store(path)` with synchronous methods; SQLite transactions own all mutation boundaries. IDs are random UUIDs. Throw errors with safe `code` and `message` (conflict=409, invalid=400, not_found=404).

- `library()` -> `{characters,personas,stories}`. `createCharacter(data)`, `createPersona(data)` -> record with `id`. Accept a bounded name plus definition text; character includes opening. `createStory({characterId,personaId,title})` snapshots both, default controls `{tone:'Natural',detail:'balanced',length:'medium'}`.
- `getStory(id)` -> `{id,title,character,persona,controls,revision,scene,messages,memories,threads,relationship,thoughts,summary,generations}`. All state is story scoped. Messages `{id,role,text,createdAt}`; memories `{id,kind,key,text,sources,pinned,corrected,conflict?}`; threads `{id,key,text,status,sources}`; relationship/thoughts are source-linked entries, not scores or hidden reasoning.
- `setControls(id,controls)` -> story. `editMemory(id,memoryId,{text?,pinned?})`, `deleteMemory(id,memoryId)` -> story. Corrections suppress original text, deletion writes tombstones that also filter summaries and later extraction. `deleteStory(id)` deletes its data. `close()`.
- `beginTurn(id,{requestId,text})` -> `{generation,context}`; generation `{id,status,userMessageId,...}`; returns same attempt on duplicate requestId. Reject a different request while one pending. `context` includes character/persona snapshots, controls, scene, active state, summary, last six messages (including current), source IDs, suppression instructions, and story revision. Never send entire old transcript. `finishTurn(id,generationId,output)` validates then atomically applies output and completion; `failTurn(id,generationId,code)` leaves no model state. Startup marks leftover pending attempts interrupted. Expose failed attempts for explicit retries with new request IDs, never retry automatically.

## Model output (strictly validated before any application)

`{reply, memories, threads, relationship, thoughts, scene}`. Arrays limited to 16 each. `memories`: `{kind:'fact'|'belief'|'event',key,text,sources:string[]}`; `threads`: `{key,text,status:'pending'|'completed'|'cancelled'|'superseded',sources}`; relationship/thoughts: `{key,text,sources}`. `scene`: null or `{text,fictionalTime,sources}`. Nonempty bounded strings, known keys only, sources limited to current context's message IDs. Never advance fictional time from wall time. Conflicting same-key facts retained for reconciliation unless owner correction has priority. An existing completed thread cannot silently become pending.

Store exports `validateOutput(output,sourceIds)` and `outputSchema` for shared provider validation. Suppression is enforced by store, not merely a model instruction. Summaries derive from active state to avoid reintroducing deleted facts.

## HTTP/UI contract (coordinator owns `app/server.mjs`)

JSON API, owner session required; errors `{error:{code,message}}`.

- `GET /api/session` -> `{authenticated,provider:'fake'|'chatgpt',model}`; `POST /api/login {password}`; `POST /api/logout`.
- `GET /api/library`; `POST /api/characters`, `/api/personas`, `/api/stories` with store payloads.
- `GET /api/stories/:id`; `PATCH /api/stories/:id/controls` with the complete three controls.
- `PATCH /api/stories/:id/memories/:memoryId {text?,pinned?}`; `DELETE` same path; `DELETE /api/stories/:id`.
- `POST /api/stories/:id/turns {requestId,text}` -> HTTP 202 `{generation}`. Server generation continues if browser disconnects. Poll story for status/completed messages, do not automatically issue a second inference. API returns no provider secrets or raw model envelopes.

## Provider contract (`app/provider.mjs`)

`await createProvider({mode,accountId,model,dataDirectory,keyDirectory,...testOptions})` -> `{name,model,generate(context,{onDelta?}),close()}`. Fake mode explicitly labelled; deterministic synthetic storytelling demo, never pretend live inference. ChatGPT mode uses the verified M1 auth/vault and protected single-owner connection, discovered model selection, `store:false`, required streaming, strict full output schema, terminal completion and local validation. Acquire vault lock across lifetime; don't select accounts by ambiguous email or expose identity to browser. Default chatgpt; fake explicitly selected. Missing sign-in is actionable, no fallback. Bounded one inference per explicit turn. Source/schema/state errors must fail without partial state. Raw JSON deltas stay server-side; the current UI displays the validated final narrative with polling for persisted status.

Distinct ownership: memory engineer `app/store.mjs` and `app/tests/store.test.mjs`; Android developer `public/`; model engineer `app/provider.mjs` and provider tests; coordinator server, configuration, documentation, integration; independent QA tests/report. Agree any contract adjustments with coordinator before cross-owner edits.
