# Milestone 3 upgrade and device checks

This release is installed manually by the owner. Agents have not accessed the running host, private stories or credentials. Keep the same Portainer stack and named volumes, and record the current image digest before changing it.

## Before upgrading an earlier image

The earlier image does not contain the new backup helper. Stop it cleanly and copy the complete story directory, including any SQLite journal files, into a private host backup directory. Substitute your container name in an authenticated host shell:

```sh
umask 077
container='storychat'
backup="$HOME/storychat-backups/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup/stories"
docker stop --time 150 "$container"
docker cp "$container:/var/lib/storychat/stories/." "$backup/stories"
docker start "$container"
```

Check each command before continuing; if copying fails, restart the original container deliberately and resolve the backup failure. Protect/encrypt the private backup using existing tooling. Do not include provider/key volumes in ordinary story backups or test restorations.

## Update and rollback

Use the tested image reference in the milestone 3 verification report as `STORYCHAT_IMAGE` in Portainer, then pull/redeploy manually. Preserve all volumes and the existing origin, password and provider settings. Wait for healthy status, log in again and check existing stories before generating anything.

The database tables remain compatible with the earlier image, but new turn metadata is additive. A reliable rollback restores the pre-upgrade stopped story copy into a fresh story volume with the recorded earlier image, while keeping one active provider connection. Do not overwrite or restore a running database, start two provider instances or delete the original volumes during troubleshooting. Recovery testing uses an isolated fake-provider instance, never a duplicate production session. See [backup/restore](backup-restore.md) for the new lossless logical backup command and portable export distinction.

## Owner acceptance

On Android Firefox and any installation browser you use, verify:

1. Edit, duplicate, archive/unarchive and delete an unused synthetic character/persona. Existing story snapshots must remain unchanged.
2. In a new synthetic story, establish a fact, correct/pin it, then edit/regenerate the latest turn. Confirm stale automatic memories disappear and owner changes remain. Older pre-upgrade turns have no safe rollback snapshot; create a new turn first.
3. Close/background/lock and reopen the phone during a request; inspect saved status before explicitly retrying. Check keyboard scrolling and draft preservation.
4. Follow Install app guidance, launch from the home screen if supported, and verify login/logout and private data access.
5. Export a synthetic notebook; test import into an isolated fake instance. Duplicate IDs must be refused without partial imports.

Each explicit edit/regeneration sends one new request using your ChatGPT allowance. Replies remain withheld until structured output and state validate; incremental visible narrative streaming is not implemented. No automatic retry or paid fallback is introduced.
