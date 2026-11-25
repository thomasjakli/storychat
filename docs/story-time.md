# Fictional time and historical reconstruction

Implemented locally on 2026-11-25. No live inference, publication, deployment or production-data migration was performed.

## Behavior

Stories retain source-linked fictional time checkpoints, independent of real message timestamps. The provider receives the current story clock and a bounded temporal supplement for selected memories, open threads and relationship evidence. A story can track relative minutes without inventing a date: an activity introduced in the first exchange followed by “two hours later” has 120 tracked minutes since its evidence. Explicit full dates and 24-hour times can anchor the clock; partial references such as Monday morning remain labels. Date-only evidence permits calendar-day comparisons, not exact elapsed hours. The arithmetic uses a fictional local calendar; it does not infer a real timezone or daylight-saving rules.

The normal reply schema adds nullable `storyTime`: `advanceMinutes`, `date`, `time`, `label`, and `sources`. All fields are required inside a checkpoint; existing saved outputs without the new field remain accepted. A numeric advance is a nonnegative whole number of minutes, at most 100 years per checkpoint. Zero clarifies the same instant. Null means an unknown interval. Dates and times are validated, citations must be permitted transcript/reply IDs, and a newly authored checkpoint commits atomically with the reply. Structural validation cannot prove that a model's proposed time follows its prose.

The latest user message's recognized time cues already appear in request context, so instructions prohibit counting them again in the assistant checkpoint. A reply with null time cannot be independently reparsed into a second time skip. Unknown gaps and backward dates/clocks split the relative timeline rather than inventing elapsed hours. Passing real days between app visits never advances the fictional scene. Dedicated fictional thoughts never advance time or supply temporal evidence.

Memory timing means **first retained evidence**, not necessarily event onset. Threads retain their original sources when later updates replace their current description/status. New instructions require actual starts, durations and deadlines to remain explicit in memory/thread prose and forbid treating the age of a mention as an established activity duration. For older threads whose original evidence was already overwritten, the lost onset remains unknown. Time passing does not itself resolve promises, create events, or change relationships.

## First startup after updating

Opening the database reconstructs a versioned timeline for each story that lacks one, inside the existing startup transaction, before serving requests. This uses no provider calls or background model workload. It preserves transcript text, story revisions, memories, pins and corrections. Subsequent saves rebuild the derived timeline from active evidence; unchanged restarts skip the migration. Portable imports rebuild it immediately too.

The conservative parser recognizes English/German explicit markers at the beginning of a message:

- `Story time: 2026-11-25 08:00`, `Scene time: ...`, `Story date: ...`, `Scene date: ...`, `Erzählzeit: ...`, `Szenenzeit: ...`, `Szenendatum: ...`.
- Standalone stage directions such as `2 hours later.`, `*Two days later*`, `*Drei Stunden später*`. Numbers one through ten in English/German are supported, along with numeric minute/hour/day/week durations that resolve to whole minutes.
- Standalone vague transitions such as `*The next morning*` or `*Am folgenden Tag*`, recorded as unknown gaps.

An initial relative origin supplies no calendar date or time of day. Quoted dates, ordinary dialogue about the past/future, promises and arbitrary prose are not used as clocks. The current legacy `scene.fictionalTime` remains available to the provider, but is not assigned retroactively to its cited messages: citation time does not prove event time.

**Historical reconstruction is partial.** The parser cannot reliably interpret every natural-language time reference, implicit transition, flashback or ongoing activity. Context explicitly labels its coverage as explicit checkpoints only. Tracked intervals in old stories are not proof of exact total elapsed time when intervening prose contains unrecognized shifts. An upgrade cannot recover a date or start that was never stated. Broad semantic reconstruction using the model would require a separate bounded, reviewable migration design; this implementation deliberately does not silently launch whole-transcript inference at startup.

For reliable new temporal grounding, the owner can write an ordinary explicit scene reference, for example `Story time: 2026-11-25 14:30`, followed later by `2 hours later.` The normal model can also recognize natural-language references and author validated checkpoints in future replies. Live model compliance remains unverified.

## Recovery and limits

The stored story/API exposes a derived `timeline` with checkpoint provenance. No visible interface layout changed. The complete checkpoint ledger remains in storage; request context includes the current checkpoint and temporal evidence for up to 64 selected records, capped at 8,000 UTF-8 bytes. Pending threads take priority in that supplement. Ordinary context limits and memory selection continue to apply; this is not a recall-retrieval redesign.

Replacement replays active messages, excluding superseded replies and their time. Failed/interrupted user attempts cannot leave time changes behind, including after default export drops the request ledger. Historical terminal contexts, regeneration baselines, portable exports, offline backups and imports support the new fields. Portable exports omit the derived cache and reconstruct it from retained messages on import. Older binaries may reject the new message/thread fields: preserve a stopped-instance pre-upgrade database/media backup and its compatible image for rollback.

The Docker runtime allowlist and exact-source container smoke inventory include the new timeline module. Container build/lifecycle verification is still required before release. No frontend screenshot review is applicable to this backend-only update.

## Reproducible checks

Use Node 24 from the repository root:

```sh
node --test app/tests/timeline.test.mjs
node app/test.mjs
node prototype/test.mjs
git diff --check
```

Synthetic tests cover relative time without dates, midnight rollover, EN/DE reconstruction, unknown and backward intervals, date precision, source validation, restart idempotence, protected state, old evidence beyond recent context, bounded temporal context, thread origin preservation, replacement/replay, failures, recovery and story isolation. These are deterministic software checks, separate from live-model quality, Linux-container verification and real Android acceptance.

Local verification (2026-11-25, Windows Node 24.22.1): 140 application checks, 138 passed and two Linux-only skips; 62 adapter checks, 61 passed and one Linux-only skip. All eleven new chronology checks passed. Diff whitespace checks passed. Docker daemon was unavailable, so no image build or container lifecycle result is claimed. No live model, real Android or deployed-instance testing was performed.

Release verification (2026-11-25): owner authorized commit/push. [Workflow 45651929896](https://github.com/thomasjakli/storychat/actions/runs/45651929896) verified implementation `03775ab7c7aeafa08ca468fa4af6bdbfc31e0d8d`: all 140 application and 62 adapter checks passed on Linux without skips; Compose, Linux amd64 image build, and both container lifecycle/isolated restore runs passed. Published `ghcr.io/thomasjakli/storychat:latest`, commit tag `sha-03775ab7c7aeafa08ca468fa4af6bdbfc31e0d8d`, and immutable `ghcr.io/thomasjakli/storychat@sha256:2305f8becdb25f2b49a73453e878a2d6a01e1091340c7c8102932f3e45142706`. This supersedes the preceding container-pending/local-only status. The running instance was not changed; preserve a stopped-instance backup before re-pulling/recreating. Historical reconstruction limits and unverified live-model behavior remain as described above.
