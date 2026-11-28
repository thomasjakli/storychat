# Story lore

The chat composer's Story actions menu contains **Add Lore**. Entries have a title and background text; the same dialog lists saved entries for editing/removal. They belong only to the current story, even when other stories reuse a character. Existing stories default to an empty collection without a migration.

Lore can describe characters, organizations, places, secrets or world background. Saving sends no model request, adds no message or memory and advances no fictional time. Normal replies receive the bounded collection as untrusted narrative background. Instructions ask the storyteller to keep it in reserve, reveal small details progressively when relevant and optionally use fitting narrative hooks/events. No next-reply disclosure, compulsory twist, retroactive encounter or automatic character knowledge is requested. Established continuity, corrections, pins, boundaries and player agency take precedence. Pacing depends on model compliance; deterministic tests do not establish narrative quality.

Lore IDs are excluded from the evidence whitelist. New developments must appear in the story before becoming source-linked state, using transcript/reply evidence. Lore survives reply replacement; editing/removing it does not rewrite established transcript events or their memories. Dedicated thoughts retain their existing reaction-only evidence contract.

## Storage and limits

Lore is part of the SQLite story aggregate. Authenticated same-origin PUT/DELETE routes require an expected revision and reject changes while the story has a pending reply/thought. Identical PUT retries and repeated DELETEs are harmless. Stale writes cannot silently overwrite newer background. Failed requests retain editor text; closing/reopening and switching entries retain unsaved edits during the page session. Entries show Draft while they have unsaved changes and Saved after a successful save. Unsaved new entries also appear in the list; their text is never sent to the provider. For edited saved entries, the last saved version remains available to the story until edits are saved. Reload does not persist unsaved lore drafts. Logout clears the editor.

Limits: 24 entries per story; title 100 characters; body 12,000 characters; all titles/bodies together 24,000 characters. All lore fits within the existing overall context budget. Oversized protected context still fails explicitly rather than deleting history. No new dependencies or infrastructure.

Portable notebook export/import and offline backup validation preserve lore, including historical generation contexts. Backups without lore remain supported. Older application versions may reject backups containing lore; keep a pre-upgrade backup and compatible image for rollback.

## Verification (2026-11-28)

With Node 24, from the repository root:

```sh
node --test app/tests/lore.test.mjs app/tests/server.test.mjs
npm test
```

Full suite on Windows: 169 checks, 167 passed, two Linux-only skips, zero failures. New synthetic checks cover story isolation, absence of save-time events/inference, evidence exclusion, idempotency, stale/pending mutation rejection, failed-turn replacement, portable/history recovery, legacy acceptance, bounds/invalid records, authentication and cross-origin denial. HTTP tests required loopback access outside the sandbox.

Headless Edge against a separate in-memory fake-provider preview exercised save/edit/remove, forced conflict with draft retention, paused save with disabled controls and keyboard open/Escape. Inspected rendered menu/editor screenshots at 360px, 390px and 1280px in English/German. Long German titles exposed narrow columns; moving mobile actions below titles resolved that issue on reinspection. Dialog measurements found no horizontal overflow. Error/disabled states were viewed at 360px; disabled primary-button contrast was improved. This is desktop emulation, not Android-device or screen-reader verification. No live-model narrative evaluation, container build, publication or deployment was performed.


### Expanded editor and entry status

Owner selected Draft/Saved status indicators rather than a separate persisted draft mode. Background limit is now 12,000 characters per entry, with a larger text area and 24,000-character story total. The lore HTTP route accepts up to 64 KiB for a full Unicode body; the existing overall context budget remains unchanged. Unsaved drafts remain page-session-only and are cleared on reload/logout.

Verification: full Windows Node 24 suite 170 checks, 168 passed, two Linux-only skips, zero failures. Added long Unicode context/recovery coverage and enlarged the authenticated HTTP save fixture to 12,000 Unicode characters. Headless Edge exercised a full-length Unicode save, Draft-to-Saved transitions, independent unsaved entries, switching/reopening without draft loss, and saved status after reload. Inspected updated editor screenshots with both statuses and long titles at 360px, 390px and 1280px in English/German; no horizontal overflow. No real Android or live-model evaluation.
