# Morning and activity-start correction, version 3

Owner-authorized corrective update, 2026-11-25. Version-2 cue recognition discarded an affirmed morning when unrelated negation occurred elsewhere in the same sentence, missed longer German separable-verb phrases, and sometimes treated overnight sleep as a nap because the last recognized day part was stale. Retrieval could confuse a later work phase or incidental narration in the current question with the original activity start.

## Reconstruction

The existing first-startup migration now rebuilds missing, version-1 and version-2 timelines into version 3. It preserves transcript text, story revisions, protected memory and corrections. No provider calls or automatic inference workload are introduced.

Negation, hypothetical statements and plans are scoped to a cue's predicate instead of discarding the entire sentence. Explicit morning cues remain usable when a later clause contains an unrelated negation. Recognition adds longer German wake/sleep forms, morning/day-after variants, daybreak and current meal/day-part actions. Verb forms are constrained so words for adulthood, growing or sleepiness do not become awakening/sleep events. Habitual and feared/hypothetical awakenings remain excluded.

Short-sleep durations in English/German prevent a brief sleep from creating a new day. Their scope is the relevant sleep interval, not every later sleep in the message. A morning/afternoon label from far earlier in the conversation no longer makes subsequent sleep a nap by itself. Existing morning-echo, midnight, quotation, failed-turn and replacement handling remains covered by regression tests. Narrative inference is still heuristic, not a complete semantic interpretation of arbitrary prose or an exact-hour clock.

## Activity reference

Temporal query terms now exclude paired narrative spans and common conversational/time filler, reducing matches to incidental meals or unrelated actions. The temporal supplement retains source-linked candidates labelled `preparation`, `start`, `phase`, `plan` or `progress`. Preparation, hands-on work and a later phase remain distinct. The bounded six-excerpt supplement reserves relevant reference candidates before repetitive progress messages consume its slots; existing 8,000-byte and overall context budgets remain.

An optional `activityStartSourceId` identifies the requested reference candidate: original work by default, preparation/layout when explicitly requested, or a later phase when explicitly requested. It must reference an included transcript excerpt and remains a candidate for the model to verify against the prose, not an automatically established new fact. The provider instructions prohibit silently resetting an overall activity's age at a later phase and prefer original sources/reconstructed transitions over a previous character reply's unsupported arithmetic. Estimates and deadlines remain distinct from elapsed time. Older archived contexts without the new fields remain importable.

## Privacy and verification

The owner export stays at its original external location. Private verification reads it in place, uses only in-memory computation and reports short count/candidate summaries. Neither the export, conversation excerpts, story identities nor a derived private fixture belong in source control, test artifacts, ordinary logs or documentation. Public regressions use original synthetic workshop/mosaic/clock scenarios. There is no live provider request with the export during verification.

With Node 24:

```sh
node --test app/tests/temporal-reconstruction-v3.test.mjs
node app/test.mjs
node prototype/test.mjs
git diff --check
```

Regressions cover scoped negation, long verb phrases, hypothetical/habitual/future wording, stale day parts, short sleeps followed by overnight sleep, lexical false positives, initial preparation versus work versus later phases, query narration, estimates, reserved onset evidence, version-2 startup migration, full request context, source-pointer validation, portable recovery and restart idempotence. Deterministic state/context checks do not prove live-model compliance or Android-device behavior.

Preserve a stopped-instance database/media backup and compatible pre-upgrade image before re-pulling/recreating. Version-2 caches rebuild automatically; ask the elapsed-time question again or regenerate the latest answer afterward. Stored old replies are not rewritten.

Local verification (2026-11-25, Windows Node 24.22.1): 165 application checks: 163 passed, two Linux-only skips; adapter 62 checks: 61 passed, one Linux-only skip; zero failures. Eleven new synthetic v3 checks and all earlier chronology/recovery checks passed. An authorized in-memory audit of the external export matched the independently established interval and distinguished the requested original reference from the later phase; only short audit summaries were emitted, and the export was unchanged. No live-model request or device verification was performed.
