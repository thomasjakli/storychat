# Bounded story progression evaluation

2026-10-31. Six owner-authorized ordinary subscription requests completed, no failures, retries, model changes or paid fallback. Model explicitly selected by owner: gpt-6.1-sol. Original synthetic scenarios only; no production stories, private reference research or migration conversations accessed.

## Method and limits

Three paired single-turn comparisons: quiet observatory/cartographer, greenhouse after repeated reassurance, and German clockmaker discovery. Each pair used identical narrative data/source IDs. Before used provider and context instructions from release64e56be; after used updated guidance. Both used the current reserved assistant-reply ID contract. This measures guidance differences, not exact replay of the old runtime, expanded context-window benefits, long-run repetition or a statistically reliable quality improvement. One sample per condition, sequential before/after, no blinding or randomization. Structured validation passing does not establish semantic correctness.

## Observed outputs

- Observatory: before offered quiet company and asked what the visitor wanted to see. After Rowan dealt with a ceiling drip and opened a footpath map, adding practical scene activity without deciding the player's response. New leak event and scene cited the reserved reply ID.
- Greenhouse: before asked whether the visitor wanted a tour or to wander. After introduced an unfinished banner, donated plants and dry humor (a sign reading COMMUNITY GREENHO), providing things to explore without forcing a player action. Scene references included the new reply.
- German clockmaker: both versions introduced a watch problem, so the baseline was not wholly passive. After additionally demonstrated the watch ticking upright and stopping when tilted: "Da. Genau das." This is a concrete discoverable situation; the event and scene cited the new reply.

Across these samples, after replies contained more concrete developments and were longer. No forced player speech/feelings/consent, invented shared past or automatic intimacy was observed in these six outputs. Before replies already showed some creativity, particularly the clockmaker. None of the three before replies proposed scene/state changes; all three after replies proposed a scene, and two proposed an event visibly present in the authored reply. This is encouraging bounded evidence, not a promise of consistently improved pacing. Longer replies may need owner review against response-length preference.

## Reproduction

The explicit harness scripts/evaluate-progression.mjs is opt-in and refuses an existing output file to prevent accidental duplicate spending. Requires a locally authorized single-account protected vault and an explicitly selected available model. It sends at most6 requests and stops on first failure, without automatic retry. No server or production data needed. Raw synthetic outputs remain in ignored analysis/progression-live-results.json.

```powershell
$env:STORYCHAT_EVAL_MODEL='gpt-6.1-sol'
node scripts/evaluate-progression.mjs --run-six
```

Do not rerun as ordinary CI or a recurring task. Re-running requires an intentional new bounded evaluation and fresh output path; respect account limits. Dedicated inner-thought instructions remain reaction-only and were not expanded by this update.
