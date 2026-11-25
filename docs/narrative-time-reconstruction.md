# Narrative day reconstruction, version 2

Owner feedback after the first chronology release: explicit-marker backfill missed ordinary narrative evenings, sleep and waking. Replies could not count days since a particular activity started, despite those transitions appearing in the full transcript. Version 2 addresses both reconstruction and retrieval. The private feedback screenshots are not shipped fixtures.

## Existing chats on startup

The server automatically rebuilds every missing/version-1 timeline from its active transcript on first startup after the update. Existing messages, story revisions, memories, corrections and pins are preserved. No story deletion, re-import, credential change, inference call or paid fallback is needed. Existing assistant replies with `storyTime: null` are included in narrative analysis: the first release's null field must not permanently hide older day changes. Failed/interrupted user attempts, superseded messages, intro text and dedicated private thoughts are excluded. Unchanged version-2 restarts do not repeat the migration.

The ordered English/German cue analysis maintains an independent relative story day and day part, alongside the existing exact-minute/calendar clock. Bedtime establishes sleep; waking after a night changes the relative day. Adjacent user/assistant descriptions of the same morning and repeated awakenings of different characters do not each add days. Explicit next-morning transitions can establish a new day without a preceding bedtime paragraph. Inline multi-day/week skips also count. A single message can contain several day transitions, in which case its start/end day positions are retained for contextual interpretation.

The parser checks ordinary prose throughout messages, not just standalone markers at the beginning. It recognizes inflected German wake/sleep forms and English actions. It excludes clear quotations, plans, negations, recollections and imagined scenes. Afternoon naps, opening eyes without prior sleep, and waking in the middle of the night are distinct from the next morning. Explicit dated/elapsed checkpoints remain available and are not added again to an equivalent narrative overnight transition.

Three inferred overnight transitions mean three observed day changes. If an activity started on the first day, this is the fourth inclusive workday, with three story days elapsed. It does **not** prove exactly 72 hours. An inferred morning does not invent 08:00 or a year/date. A previously established full date can advance by inferred calendar days, with inferred provenance retained.

## Answering questions about older activities

Counting days is insufficient when the request omits the old activity onset. For elapsed-time questions, the server now searches the full active transcript for relevant passages, preferring likely starts over repeated later mentions when relevance is otherwise comparable. This also works for an onset that has no surviving standalone saved memory or whose thread sources were subsequently replaced.

The bounded request supplement includes up to six source-linked excerpts, capped together at 8,000 UTF-8 bytes. Each carries its start/end relative day, day changes since the passage, and uncertainty. Excerpts are centered near matching activity words so a relevant passage late in a long reply is not silently truncated away. Matching saved records take priority over unrelated pending threads in the existing temporal evidence supplement. All additions remain within the normal request budget and story/source boundaries. Suppressed exact text, failed sources and private thoughts are excluded. Imports validate that historical excerpts actually occur in their cited transcript messages.

The reply instructions require using this evidence to explain elapsed days without refusing merely because no calendar date was stated. The model must distinguish the actual start from an earlier discussion, estimate or later progress report. The start and end of a multi-day message can differ; reading its prose remains necessary to place the activity within that range.

## Confidence and limits

This is source-linked **inference from recognized narrative cues**, not a general semantic reconstruction model or a guarantee that every possible wording is recognized. Unknown gaps break the day-count interval; a gap before an activity does not invalidate later well-supported counts. Flashbacks, omitted days, unusual wording, metaphors and ambiguously narrated naps remain possible limitations. Counts should be presented as based on the reconstructed narrative when they are inferred. Real message timestamps never determine fictional time.

The full deployed transcript has not been supplied in this task. The screenshots demonstrate the reply failure, not the true number of days in that story. No claim is made that the owner's actual day count has been independently verified. The regression uses an original synthetic observatory-repair story with three ordinary German overnight cycles, a buried onset and no calendar markers; it is separate from private story content.

## Verification and deployment

Run with Node 24:

```sh
node --test app/tests/narrative-time.test.mjs app/tests/timeline.test.mjs
node app/test.mjs
node prototype/test.mjs
git diff --check
```

Checks cover complete version-1 startup rebuilding, long-chat onset retrieval, three-night reconstruction, German conjugation/word order, English prose, same-message multiple days, morning echoes, naps, midnight waking, future/past/quoted text, inline multi-day jumps, unknown gaps before/after onset, supersession, source-turn replacement, failed attempts, protected state, portable recovery, exact excerpt validation and restart idempotence. These checks establish deterministic software behavior, not live-model compliance or device verification. No visible UI changed.

The runtime packaging allowlist and container smoke inventory include `app/narrative-time.mjs`. Preserve the stopped-instance pre-upgrade database/media backup and compatible image for rollback. After re-pulling/recreating a verified image, version-1 stories rebuild automatically. A reply already stored before the rebuild remains historical; explicitly regenerate the latest answer or ask the elapsed-time question again to use the new context.

Local verification (2026-11-25, Windows Node 24.22.1): 154 application checks, 152 passed and two Linux-only skips; 62 adapter checks, 61 passed and one Linux-only skip. All 14 new narrative reconstruction checks and 11 prior timeline checks passed. Diff whitespace and runtime source syntax checks passed. No live inference, production transcript access or device verification was performed.

Release verification (2026-11-25): [workflow 45686391588](https://github.com/thomasjakli/storychat/actions/runs/45686391588) verified implementation `12f686f781dbae5286464a366b899e8eced8d1b8`: 154/154 application and 62/62 adapter checks passed on Linux without skips; Compose, Linux amd64 build and both container lifecycle/isolated recovery runs passed. Published `ghcr.io/thomasjakli/storychat:latest`, `sha-12f686f781dbae5286464a366b899e8eced8d1b8`, and immutable `ghcr.io/thomasjakli/storychat@sha256:6bd58adc21ca7429faee20b2f02426df9f430cf77f929737c8105fdd2b9e3dde`. No live inference or production deployment was performed.
