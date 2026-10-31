# Persona and character refinement update

Implemented, reviewed and published. Linux/container verification passed. Device acceptance remains pending; no production deployment performed.

## Backup and upgrade

1. Record the running image digest and retain the current Compose configuration. Download a private notebook export; it includes media but omits regeneration history. For lossless recovery, stop Storychat and take an offline logical backup including the media directory, or a consistent stopped-volume backup. Protect provider/key volumes separately; they contain credentials and never belong in item exports. See [backup/recovery](backup-restore.md).
2. Preserve all four existing named volumes: story-data, media-data, provider-data and provider-key. No new volume or environment variable is required. Do not rename volumes or clear browser storage.
3. Select the verified release digest (recorded after publication), or ghcr.io/thomasjakli/storychat:latest, and explicitly re-pull/recreate in Portainer. Check health, owner login, an existing story, memories and pictures.

Offline logical backup using Node24, with application stopped and dedicated private paths:

```sh
STORYCHAT_MEDIA_DIR=/private/media node app/backup.mjs backup /private/stories/storychat.sqlite /private/backups/pre-refinement.json
STORYCHAT_MEDIA_DIR=/private/isolated/media node app/backup.mjs restore /private/backups/pre-refinement.json /private/isolated/stories/storychat.sqlite
```

Run restored data only in an isolated fake-provider instance with separate password/port and no production provider/key mounts.

## Rollback

Stop the new container. Retain its story/media storage separately. Use the prior immutable image digest with fresh storage restored from the stopped pre-upgrade backup, following that release's recovery procedure. Retain protected provider/key volumes unless sign-in recovery is needed. Older validation may reject newly expanded personas; do not simply run the old image on new data. Do not overwrite production storage during a restore test.

## Owner Android Firefox and Chrome checklist

- English/German: Personas navigation, narrow layouts, readable primary buttons, keyboard and browser back.
- Create/edit persona with age, gender, likes/dislikes and picture/focal point; reload and verify persistence. Test an unsaved draft across navigation/language switching.
- Start a story with that persona; edit the library persona and verify the old story retains its snapshot while a new story uses the edit.
- Export one character and one persona, with/without pictures. Preview/import into a populated library; repeat and verify independent copies without overwrites.
- Verify dialogue versus gray italic narration in both user and assistant messages, including long passages and literal asterisks.
- Terse character plus long/rich preferences should preserve short dialogue; warm/romantic preferences should not force intimacy. These are variable live-quality observations, separate from automated contract tests.
- Restart/recreate and verify fields, media and memories. Test recovery only in isolated storage.

No live provider evaluation is implied by deterministic tests. Native StoryChat item transfer does not imply third-party format support. Existing story snapshots are not migrated.

## Automated evidence

Independent Windows Node24 checks: application83 passed,2 Linux-only skipped; adapter61 passed,1 Linux-only skipped. Synthetic coverage includes persona defaults/age zero, old transfers, immutable snapshots, fresh item/media identities, invalid preview without writes, forced import rollback, retained picture references and isolated offline backup/restore. QA found and fixed stale asynchronous editor/import completion races. No live inference used. Linux CI passed85/85 application and62/62 adapter tests without skips; both verification and publish-candidate container lifecycle/recovery checks passed.

## Rendered visual review

Inspected synthetic browser screenshots in English/German at360px and390px, plus1280px desktop. Covered persona library/detail/editor top and bottom, mobile character filter regressions, primary-action contrast, narration on message surfaces and English360px import preview. Review prompted two-column mobile navigation and compact accessible editor-close fixes. No clipping issue remained in the inspected views. Screenshots were viewed through browser tools; this is viewport evidence, not real Android acceptance. Filechooser automation was slow, but a valid synthetic item reached the preview. German import-preview end-to-end device checking remains in owner acceptance.

## Published release

Implementation: [297de63](https://github.com/thomasjakli/storychat/commit/297de632f1fa7b6369678d6975a2ef20d67dc927). [Successful workflow](https://github.com/thomasjakli/storychat/actions/runs/41218647434).

```text
ghcr.io/thomasjakli/storychat:latest
ghcr.io/thomasjakli/storychat@sha256:8a6938fcd0e0442eeb95291299178f6d8be5b28a5ee21c4c63d2b3340e200847
```

No production rollout performed. All independently verifiable release checks passed; Android/manual acceptance and variable live-model quality remain owner follow-up.
