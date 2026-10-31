# Story progression release

Implemented, reviewed and published; not deployed. No UI changes planned.

## Behavior

Ordinary replies may introduce character actions, scene details, personal revelations, plausible interruptions and natural fictional time progression. Character consistency and corrected history remain binding. Player agency, consent and private knowledge are not overridden. No required twist or escalation every turn. Dedicated generated inner thoughts remain reactions to existing evidence.

Newly authored events can cite the reserved ID of the reply being created; reply and derived state commit atomically. Source IDs/schema checks establish structural validity, not semantic truth. Live comparisons assess whether proposals are actually supported. Recent context is bounded, not the full transcript.

## Upgrade and rollback

1. Record running image digest and Compose. Export a private notebook backup. For lossless history, stop the app and back up database/media consistently; protect provider/key volumes separately.
2. Retain all four existing story/media/provider/key volumes; no new environment variable or volume. Select the tested image digest or latest and explicitly re-pull/recreate in Portainer.
3. Verify health/login, old memories and a separate test story. New prompts apply to future requests; existing transcripts are not rewritten.

Stopped-instance offline backup/isolated restore, Node24:

```sh
STORYCHAT_MEDIA_DIR=/private/media node app/backup.mjs backup /private/stories/storychat.sqlite /private/backups/pre-progression.json
STORYCHAT_MEDIA_DIR=/private/isolated/media node app/backup.mjs restore /private/backups/pre-progression.json /private/isolated/stories/storychat.sqlite
```

Run restored data in a separate fake-provider instance with separate password/port, no production provider/key volumes.

Rollback: stop the new container, retain upgraded storage separately, restore the pre-upgrade story/media backup into fresh storage and run the previous immutable image with compatible Compose. Keep protected provider/key volumes unless reauthorization is necessary. New generation/source metadata may be rejected by older validation; do not rely on image-only rollback against upgraded data.

## Manual quality checks

In a separate story, give short replies and allow character initiative. Look for meaningful but plausible developments instead of repeated reassurance/gestures/questions. Check quiet scenes remain possible, no compulsory escalation, no invented shared past and no forced player decisions. Verify new events appear in memory with links to their introducing assistant message. Correct/delete a fact and replace the latest turn; verify invalidated developments do not return. Existing thought and reading controls should remain unchanged. These are variable live-model observations, separate from deterministic software tests.

## Software verification

Windows synthetic application98passed/2Linux-only skips; adapter61passed/1Linux-only skip. Independent review covered reserved-reply sources, forged missing IDs, atomic persistence/deduplication, replacement removing stale events while preserving corrected/pinned state, newest-complete-message context bounds, old-context lossless transfer compatibility and dedicated-thought restrictions. No UI change, so no new rendered-screen gate applies. Live results are recorded separately below.

## Bounded live comparison

Owner selected gpt-6.1-sol. Exactly6 synthetic subscription requests completed, no retries/fallback:3 paired single-turn scenarios, same narrative data and source IDs, old provider+context guidance versus new guidance. Both used the new reserved-reply transport contract; this is not a full historical-stack replay or evaluation of expanded context length.

Independent review: quiet observatory baseline offered company/activity choice (370characters); new reply developed a practical leak/footpath-map situation (1047). Greenhouse baseline already avoided exact repeated reassurance but asked another tour/wander choice (278); new reply introduced an unfinished banner, dry humor and donated plants (1056). German clockmaker baseline already introduced a watch detail/invitation (620); new reply demonstrated an orientation-dependent watch fault with optional magnifier (979). No obvious player-agency violation, history contradiction, forced romance or compulsory escalation identified. New state proposals in all3new responses were visibly supported and cited the introducing reply; all3baselines returned empty state.

This supports more concrete development and retention in this small sample, not a claim that the baseline cannot progress or repetition is eliminated. New replies were longer in every pair. Three unblinded single-turn pairs do not establish long-term pacing, relationship quality or semantic correctness generally. Raw synthetic outputs remain ignored/private; no production conversations used. No further requests scheduled.

## Published verification

[Implementation3765cc2](https://github.com/thomasjakli/storychat/commit/3765cc2cb87eda0a06d8f3938621f6b6f0741b76). [Workflow](https://github.com/thomasjakli/storychat/actions/runs/41245880486) success: Linux101/101application and62/62adapter tests, no skips, both container lifecycle/recovery gates passed. Final local suite99passed/2Linuxskips. Six live requests only, evaluated independently; no recurring workload.

```text
ghcr.io/thomasjakli/storychat:latest
ghcr.io/thomasjakli/storychat@sha256:e48722ffa68b1b599ccd9576e3f2ba4bbfad76f4c4364d7f4e82de06a1a19f15
```

[Independent writing assessment](story-progression-evaluation.md). [Live method](story-progression-live-evaluation.md). No new UI, infrastructure or production deployment. Future prompts change; existing transcripts remain untouched. Long-story quality remains owner follow-up.
