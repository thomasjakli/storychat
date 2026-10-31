# Thought blocks and reading controls: release guide

Implemented and reviewed; publication in progress, no production rollout. Real Android and live thought quality are owner acceptance, not inferred from synthetic tests.

## Backup and upgrade

1. Record the running image digest and existing Compose. Download a private notebook export. For lossless history, stop the app and take a consistent offline backup including media, or stopped-volume snapshot. Protect credential-bearing provider/key volumes separately.
2. Preserve story-data, media-data, provider-data and provider-key volumes. No new volume/environment variable is planned. Select published latest or immutable digest, then explicitly re-pull/recreate in Portainer. Do not deploy until release checks pass.
3. Verify health/login, existing stories/memories/pictures, then test the new controls with a separate story.

Offline logical commands with Node24 and stopped source application:

```sh
STORYCHAT_MEDIA_DIR=/private/media node app/backup.mjs backup /private/stories/storychat.sqlite /private/backups/pre-thoughts.json
STORYCHAT_MEDIA_DIR=/private/isolated/media node app/backup.mjs restore /private/backups/pre-thoughts.json /private/isolated/stories/storychat.sqlite
```

Run restoration only with separate storage/password/port and fake inference; never mount production provider/key volumes.

## Rollback

Stop the new container and retain its story/media storage separately. Restore the pre-upgrade backup into fresh storage and use the prior immutable image plus compatible Compose. Keep protected provider/key volumes unless authorization recovery is needed. Older releases do not understand typed thought blocks/request records; image-only rollback against upgraded stories is unsafe.

## Manual Android Firefox/Chrome acceptance

- EN/DE: long inline speech/star narration displays separate paragraphs with modest spacing; raw edit text remains unchanged.
- Decrease/increase/reset chat text at all steps. Only message bodies resize; labels/navigation/composer stay unchanged. Reload, logout/login and language switching retain the device preference. Another profile is independent.
- While reading older text, change size and verify reading position and unsent draft; at latest, remain near latest content. Check long German text and keyboard.
- Generate one thought explicitly. Verify visible busy/error/cancel behavior and preserved draft; no spoken reply or scene/state advancement. Cancel/retry/replace/delete only on a synthetic test story.
- Verify character-private thoughts are not treated as dialogue or knowledge known to the persona. Live model behavior remains variable despite prompt-contract tests.
- Restart/recreate, export and isolated restore: thought blocks and sources retained. Existing corrections/pins remain.

Existing-story screenshot migration and STT expansion remain separate. Thoughts are authored fiction, not model reasoning.

## Compatibility and evidence

Typed thought messages and additive request ledgers preserve legacy stories with absent ledgers. Imported thoughts with no reconciled supporting sources retain provenance/timeline placement but are excluded from model context. Portable exports omit request history/private contexts; offline backups preserve validated history. Superseded/deleted text can remain in historical audit/backup material as with existing turn replacement; deletion is not secure erasure. No private screenshot migration data was used.

Windows integrated checks93passed/2Linux-only skips and adapter61passed/1Linux-only skip. Synthetic coverage includes explicit requests, deduplication, failure/cancel/stale completions, source/knowledge isolation, replacement/deletion, legacy compatibility, portable continuation, isolated offline backup/restore and malformed-context rejection. Live quality and Android acceptance pending.

## Rendered review

Synthetic browser review:360px English default/150%,390px German85%/150%,1280px English default/German85%; independent reviewer additionally viewed390px English150% and360px German150%. Checked separated narration, user/assistant bodies, typed thought panels/actions and long labels. Measured message16px to24px while composer15.2px, navigation16px and labels10.4px remained unchanged. No overflow blocker identified in inspected views. Font controls are in Settings; direct in-chat reading-anchor behavior is not established by these screenshots. Source handling of blocked/corrupt storage is defensive but not real-browser failure-injection evidence.

Coordinator also viewed actual synthetic delayed loading/cancel and failed-generation states in German; no partial block was inserted. Removed redundant native confirmation before explicit generation and corrected ordinary reply-status messaging during thought requests. Browser reload retained150% reading preference, verified in Settings. Native screen-reader/device checks remain pending.
