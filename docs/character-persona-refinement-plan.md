# Character consistency, personas, narration and item transfer

Status: implemented and independently tested on Windows, 2026-10-31; Linux/container publication and rendered visual review in progress. Real Android acceptance and live model quality remain owner checks. See refinement-update.md for operational instructions.

## Change 1: Character behavior and writing preferences

Verified source: `app/provider.mjs` already tells the model to apply controls without changing identity, boundaries or facts. `app/store.mjs` supplies snapshots and controls. The instruction is brief; source review does not establish live-model compliance.

Specify explicit precedence: character definition governs identity, motivations, boundaries, characteristic reactions and speaking style. Tone guides compatible atmosphere/presentation; warm or romantic settings must not force affection, trust or intimacy. Narrative detail governs description. Response length governs the overall reply, not character speech length. A terse character can speak briefly inside a richly described scene. Prefer a shorter coherent reply over invented filler, off-screen events or unjustified relationship progress.

Preserve corrections, pins, suppression, knowledge boundaries, source validation and fictional-time rules. Evidence-based story development can change behavior; consistency must not freeze relationships. Definitions remain untrusted narrative data and cannot override application instructions or permissions. Explain the controls in English/German.

Acceptance: deterministic instruction/context tests and synthetic scenarios for terse + long/rich, distrustful + warm/romantic, and corrected facts versus historical contradictions. Preserve independent controls and snapshots. Fake tests establish software contracts only; report any bounded owner-authorized live quality evaluation separately.

## Change 2: Standalone personas and pictures

Confirmed: give personas their own browse/detail/create/edit flow, comparable to characters, with pictures, likes, dislikes, age and gender. Preserve name/definition and clearly distinguish the user persona from the AI character.

Proposals to settle during planning:

- Dedicated Personas navigation, cards/details, search and explicit selection when starting a story. Retain applicable edit/duplicate/archive/delete operations. Preserve drafts and navigation/request recovery.
- Reuse authenticated `cover`/`focalPoint`, sanitized uploads, thumbnails and storage quotas. No second media service or remote image fetching.
- Optional bounded plain-text likes/dislikes, proposed 2,000 characters each. These describe preferences, not automatically completed events or knowledge available to every character.
- Optional age in years, proposed nullable integer 0–10,000. No wall-clock aging, inferred age or use as verification/permission. Settle validation before implementation.
- Optional gender aligned with character-editor stable values and localized labels; unspecified by default. Never infer it or pronouns from images/names.
- Include structured fields in new-story snapshots/context. Structured fields govern their respective attributes over contradictory generic definition text; encourage resolving contradictions in the editor. Existing evidence/corrections/suppression still govern story state.

Acceptance: additive defaults preserve old personas/exports and existing stories. Library edits affect new stories only. All fields roundtrip. Persona pictures receive the same authentication, validation, quota, reference-aware deletion and backup/restore protections as character pictures, including story snapshot references. Library operations cause zero inference. Preserve story isolation and distinguish persona attributes from another character's knowledge. Existing-story migration is excluded.

## Change 3: Narration color

Verified: `.narration-span` in `public/style.css` uses italics with `color:inherit`.

Use a subtly distinct neutral gray alongside italics across surfaces using the narration renderer. Choose against each actual user/assistant background, with at least 4.5:1 normal-text contrast. Color is supplemental, not the sole distinction or disabled styling.

Cosmetic only: preserve raw stars, escaping, source IDs, editing/regeneration, selection wrapping and state semantics. Acceptance covers mixed dialogue/narration, long passages, openings and literal/escaped/unmatched stars. Visually inspect EN/DE at 360px, 390px and desktop; keep device evidence separate.

## Change 4: Standalone character/persona transfer

Verified: `app/transfer.mjs` structurally accepts a version-1 notebook envelope containing only library entries and an empty stories array. Current export is notebook-wide and matching IDs are rejected. Standalone end-to-end behavior has not been verified by this review.

Required:

- Detail-page export of one character or persona; library entry points for import. Include authored fields and only referenced media, never unrelated items, conversations or credentials.
- Agree on a documented versioned item format and media/API contracts before implementation. Reuse existing validated envelopes where practical; preserve supported notebook compatibility.
- Preview item type/name/fields and warnings before import. No automatic external retrieval, private-research import or inference.
- Add a fresh record by default; safely remap media identities when necessary. Repeated imports must not overwrite existing definitions, snapshots or images. Provenance remains validated untrusted data.
- Validate version/type/bounds/content/media and quota before committing; roll back staged files on failure. Localized actionable errors for invalid or missing media and unsupported formats.
- Keep additive item import separate from notebook recovery collision/history semantics. Do not silently turn backup restore into duplication.
- Native StoryChat items are required; arbitrary JSON or third-party formats are not implicitly supported.

Acceptance: both item types with/without pictures, populated destination and repeated imports, media collisions/remapping, restart, old notebook compatibility, atomic failure rollback, zero inference and unchanged independent stories. Restore a synthetic media-aware backup in an isolated fake-provider instance.

## Coordination and release

Settle schema/defaults, context precedence, transfer/media envelopes and routes before parallel edits. Suggested ownership: Story/Memory owns store/transfer; Android owns UI/localization; Security owns media/recovery; Integration owns provider instructions; independent Quality reviews integrated behavior. Coordinator owns shared server integration/documentation and explicitly assigns overlaps.

Use original synthetic fixtures. Keep private research, media, credentials, conversations, runtime data and infrastructure outside Git/images. Preserve supported ChatGPT authentication. No billed fallback, automatic inference retries, generation, STT expansion or production changes.

Require meaningful tests and rendered bilingual 360px/390px/desktop review, including prior mobile filter alignment and primary-button contrast defects. Android Firefox/Chrome owner acceptance stays pending until tested. When implementation is authorized, use the existing tested-image workflow and report latest/immutable reference and backup/upgrade/rollback instructions; do not deploy automatically.

## Agreed implementation contracts (2026-10-31)

Persona fields: cover:string default empty, focalPoint:{x,y} default0.5, likes/dislikes:string default empty max2000, age:null or integer0..10000, gender enum identical to characters default unspecified. Defaults apply on read/new snapshots, not rewriting existing stories.
Item transport: existing media-aware notebook envelope restricted to exactly one library entry and stories:[], distinguished by dedicated routes. GET /api/characters/:id/export and /api/personas/:id/export; POST /api/items/preview validates and returns {type,data}; POST /api/items/import validates/stages then adds fresh library identity and remaps media IDs, with atomic rollback. Existing /api/import recovery unchanged. UI sends the original package for preview/import. Shared ownership: store/transfer agent owns app/store.mjs, app/transfer.mjs and new app/item-transfer.mjs plus model tests; UI agent owns public/*; integration/security agent owns app/server.mjs, app/provider.mjs, media-transfer/media if needed and integration tests. Coordinator reviews contracts/docs/release and independent QA.
