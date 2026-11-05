# Long-running story memory

## Problem and implementation

The owner reported a deployed story failing repeatedly with `invalid` and exactly
200 memories, while another story continued normally. The previous accumulated
state check rejected the entire reply when new state exceeded 200 memories or
threads, or 100 relationship/thought records. This update removes those lifetime
state-count checks. Model output remains strictly validated and limited to 16
proposals per category per reply, with at most 16 permitted citations per proposal.

SQLite retains the complete transcript and accumulated state. Repeated equivalent
memory proposals (normalized key, kind and text) merge supporting source IDs without
discarding older citations. Conflicting facts remain distinct. Pins, corrections,
deletion suppression, story isolation and atomic turn/replacement checks remain.
No inference, background jobs or external service is added by this change.

Request context is a separate selection, limited to 120,000 serialized JavaScript
characters and 128,000 UTF-8 bytes. It includes the existing recent-message window
(up to 12 complete messages / 24,000 text characters), definitions, controls, current
scene and suppression rules. All pinned/corrected memories and their conflicting
fact alternatives are protected. If those mandatory records cannot fit, the send
fails with `context_limit` before persistence or provider access; nothing is silently
unpinned, rewritten or deleted.

Optional records are ranked using word overlap with the latest message and current
scene, unresolved-thread priority, then recency. Conflicting facts are selected as
a group. Older completed plans remain stored but do not automatically displace
active plans. Request source IDs come only from included evidence/messages and the
reserved reply ID. An accumulated memory exposes at most its latest 16 citations
in a request; all citations remain stored. A compact deterministic excerpt of the
selected state replaces the old first-record summary in the request. This excerpt
is redundant and may be shortened to honor the budget; it is not model-generated
consolidation or a replacement for historical records.

Only the latest replaceable turn needs a full rollback baseline. When a subsequent
request is successfully prepared, obsolete terminal prompt contexts are removed;
ordinary turns/replacements also remove obsolete rollback baselines, while thought
requests preserve the latest ordinary reply's baseline. Transcript messages, accumulated evidence and request
IDs/statuses remain. Replaying an old request still returns its saved status without
inference. Historical prompt snapshots are therefore not a permanent audit archive.
Existing older databases load without a data migration; compaction occurs on the
next successfully prepared request.

## Recovery limits and upgrade

Portable notebook JSON and the offline logical JSON backup helper support up to
64 MiB of logical application data, increased from 8 MiB. State arrays no longer
have the former 200-record import limit. The existing media envelope remains
384 MiB. Imports retain field, source, ownership/isolation and collision validation.
The JSON backup helper preserves the latest rollback baseline; browser exports
still omit the generation ledger and cannot immediately regenerate an old turn.

`transfer_limit` identifies logical byte overflow. Both browser export and
`node app/backup.mjs backup ...` use that logical ceiling. The helper is **not** an
unlimited raw database backup. For larger instances, preserve a stopped-instance
snapshot instead:

1. Stop the application and every process/helper that can access its story storage.
   Leave the named volumes intact. Do not copy a live SQLite file by itself.
2. Use the existing host/volume backup mechanism to copy the entire story-data
   directory, including any SQLite `-wal` and `-shm` sidecars, and the entire media
   directory as one stopped-instance backup set. Retain permissions and checksums;
   protect this private material outside Git. Do not remove Linux lock files.
3. Restore copies into fresh, isolated story/media storage with the compatible
   image and correct UID/GID/permissions. Use fake inference, a separate password
   and port, and no production provider/key volumes. Verify the transcript, memory
   sources, pictures and latest-turn regeneration there before relying on recovery.
4. Restart the original instance normally. Keep the original snapshot until the
   upgrade and recovery checks are accepted. Provider authorization is separate;
   do not clone rotating credentials into the recovery test.

For the affected 200-memory story, no deletion, reimport or manual database edit
is needed. Before an eventual owner-approved upgrade, preserve a stopped-instance
backup and the old immutable image reference. After deploying a verified new image,
open the original story and explicitly regenerate or edit-and-replace its failed
latest turn. This makes one owner-triggered provider request. Verify that the reply
completes and existing pins/corrections remain. Production was not changed during
implementation. Rollback requires the old image plus **pre-upgrade** data restored
into fresh storage: older binaries reject larger accumulated state/exports.

## Verification and practical limits

Run with Node 24 and the locked dependencies installed:

```sh
node app/test.mjs
node prototype/test.mjs
```

Focused synthetic regressions live in `app/tests/scalable-memory.test.mjs`,
`scalable-transfer.test.mjs` and `scalable-integration.test.mjs`. They cover thousands
of records, older relevant facts, pending/completed plans, protected information,
conflicts, suppression, provenance beyond 16 citations, bounded Unicode requests,
replacement/retry/rollback, isolation, restart and larger lossless transfers.
These are deterministic software checks, not live-model recall-quality evidence.
Independent review found and fixed an additional recovery edge: short imported
source IDs could exceed the historical 5,000-ID whitelist check while still fitting
the request budget. Full-history export now accepts those valid selected sources.

Local verification on Windows, Node 24.22.1: the application suite passes 127 checks
with two Linux-only checks skipped; the adapter suite passes 61 checks with one
Linux-only check skipped. Neither suite has failures.
The initial restricted run could not exercise local HTTP/Windows protected-directory
tests; the integrated suite was rerun with the required local permissions. No live
inference was used. `git diff --check` and runtime-source syntax checks also pass.

The current aggregate SQLite design still reads/writes and returns a whole story;
very large transcripts can affect server memory, browser rendering and latency.
This update does not promise unlimited story size or perfect semantic recall. The
existing resource bounds remain: at most 20,000 stored messages, 10,000 generation
attempts and 10,000 thought requests per story, including superseded/failed history.
New sends reserve room for their completed reply; `story_limit` identifies exhaustion.
Relevance uses deterministic word matching, not semantic search; paraphrases and
German inflections can miss older optional information. Important facts can be
pinned, subject to the explicit protected-context budget. Further indexing/pagination
or semantic retrieval should be driven by measured need, not extra model workloads.

No interface layout or frontend files changed. Real Android behavior and live
provider quality were not exercised by these synthetic checks. Linux container
verification must be run before publication; this local host has no running Docker
daemon. No image was published and the branch was not merged.
