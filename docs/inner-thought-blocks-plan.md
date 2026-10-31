# Chronological fictional inner thoughts

Status: implemented, local verification passed; rendered review and publication in progress, 2026-10-31. Extends narration without changing its existing star convention.

## Confirmed scope

- Dedicated fictional thought blocks positioned chronologically in the conversation, with distinct background and localized Inner thought label.
- Preserve imported thought text and its position instead of flattening it into dialogue, scene narration or current memory alone.
- An explicit button generates a fictional inner thought for the current chat situation, using the existing owner ChatGPT connection.
- These are authored fictional character thoughts, never access to model reasoning. They are not audible to the persona or automatically known by other characters.

## Proposed implementation contracts

Settle the final schema/API before parallel implementation. Prefer additive typed assistant messages (`kind: thought`) with stable IDs, chronology and validated source references. Existing untyped messages, intro/opening and star narration remain compatible. A thought block belongs to a specific story and character snapshot. Imported provenance and screenshot references must remain distinguishable from inferred transcript support; never invent supporting source IDs.

Keep visible chronological blocks distinct from the existing recent-thought state collection. Define one canonical text record and references to it where practical so the timeline and memory panel do not drift or duplicate thoughts. Historic blocks must survive beyond recent context and existing bounded state collections. Coordinate retention/export limits before implementation.

The Generate inner thought button is an optional, explicit one-request operation, not an automatic action after every reply. No inference on rendering, opening the panel or importing. Label it as generation using the owner's ChatGPT allowance. No paid fallback, periodic work or automatic retry. Clicking produces an independent thought block at the captured story position; it does not append dialogue or move the scene forward.

Context includes the current character/persona snapshots, validated scene, relevant memory, recent conversation and writing preferences under existing precedence. Generate only a short fictional reaction to available evidence. Do not invent hidden facts, events, new promises, another person's thoughts or relationship changes. Default to the active story language, independently of UI locale. Ordinary tone/detail/length settings cannot override identity or boundaries; propose a bounded short thought rather than a full reply.

Use a dedicated validated output contract for thought text and permitted supporting sources, not the ordinary turn state-mutation contract. No automatic promotion to fact, completed action, relationship evidence or another character's knowledge. Include these privacy/knowledge boundaries in subsequent context assembly.

Capture the story revision/source frontier before requesting. Serialize against ordinary turns and edits; reject concurrent generation and stale completions. A failed/cancelled/interrupted request inserts no partial block or derived state. Use request identity/idempotency to prevent duplicates. Never silently retry an uncertain provider outcome.

Support explicit retry as a new owner action and replacement/deletion of a generated thought without duplicate state. Define revision linkage and invalidation: editing/regenerating a source turn removes or supersedes dependent thought blocks and derived references transactionally. Corrections, pins and suppression survive. Deleting a thought removes it from future context and its derived state, with the same documented historical-backup limitations as existing deletion. Do not manufacture revisions or provider history for imported thoughts.

## Presentation

Use an original, readable muted panel with label and typography distinguishing thought from speech and star narration. Maintain at least 4.5:1 normal-text contrast. Generate control needs accessible name, loading/disabled/error states, touch targets and preserved composer draft/scroll position. Expose it in a contextual chat action area; do not overload the narration-formatting button. English/German labels and keyboard/screen-reader semantics required.

## Migration and acceptance

- Preserve screenshot thought blocks as separate private draft records now; final import must wait for compatible schema and source mapping. No automatic production migration or private research ingestion.
- Test legacy data/export compatibility, ordered thought roundtrips, source linkage, shared state/timeline consistency, story isolation, knowledge boundaries and raw-text preservation.
- Fake-provider tests cover one explicit request, duplicate clicks, busy/stale results, cancellation/failure/restart, replacement/deletion suppression, source-turn revisions and zero unintended inference/state mutation.
- Keep imported thoughts without reliable transcript support clearly marked as source-authored material rather than validated observations.
- Review rendered EN/DE360px/390px/desktop thought panels and generation states. Real Android Firefox/Chrome and bounded owner-authorized live quality checks remain distinct from deterministic tests.
- Preserve private screenshots, transcripts, credentials and infrastructure outside Git/images. Do not modify the running deployment during planning.

Suggested roles: Story/Memory owns schema/context/revisions and migration mapping; Model Integration owns dedicated generation contract through the current adapter; Android owns timeline/actions/localization; Security reviews permissions/request lifecycle; independent Quality verifies continuity and inference boundaries. Agree shared interfaces and distinct file ownership before delegation.

Narration readability dependency: owner additionally requests paragraph breaks around inline star-delimited narrative text, with modest vertical spacing and unchanged raw text. See narration-and-dictation-plan.md readability refinement. This presentation rule must not infer that all starred passages are private thoughts.

## Implementation agreement (2026-10-31)

Use canonical assistant messages kind thought with sources and origin (generated/imported), no automatic ordinary-turn thought insertion. Dedicated story thoughtRequests (additive default empty) track requestId/status/revision/context privately; public response includes safe status. Store helper names and output schema coordinated between backend agents before edits. POST /api/stories/:id/thoughts {requestId,replaceId?}; DELETE /api/stories/:id/thoughts/:messageId removes/suppresses; POST /api/stories/:id/thoughts/cancel {requestId} invalidates completion. Poll existing story GET. One global provider request at a time; cancellation invalidates result without claiming network abort and retains busy slot until request settles. Replace leaves original visible until successful replacement. Context must exclude thought IDs from permitted factual proposal sources. Thought source invalidation on latest-turn replacement and memory correction/deletion required. Model/store owner owns store/transfer; integration owns server/provider; UI owns public. Five chat body size steps85/100/115/130/150%, default100, local key storychat.chatTextSize.v1. These are routine decisions within owner scope.

Agreed helper interface: beginThought returns {request,context}; finishThought/failThought/cancelThought use requestId; deleteThought uses messageId. Provider generateThought(context) returns {text,sources}; POST202 returns {request}. Story GET exposes safe thoughtRequests for polling, never stored private contexts.
