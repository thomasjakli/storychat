# Private story backups and recovery

Export from the authenticated app to download a logical JSON backup. It contains private characters, personas, messages, current memory, corrections, pins and suppression records. Protect and encrypt this file using your existing backup tools. Provider credentials, app passwords and deployment configuration are excluded. Exports refuse while a generation is pending.

Imports validate a bounded versioned format and atomically reject identifier collisions. Restore into an empty isolated instance first. Untrusted SQL/database binaries are never accepted by import. Text remains untrusted narrative content and must never be executed as HTML or code.

Portable browser exports intentionally omit generation attempts, prompt contexts and rollback snapshots. Historical messages and current state remain, but historical turns cannot be regenerated immediately after restore; create a new turn to establish a new rollback baseline. Secure erasure of historical SQLite pages or external backups is not provided.

Offline logical backups preserve validated generation history, prompt contexts and rollback baselines, allowing recovery of regeneration support. These additional private narrative records remain credential-free. For offline operations, stop the application cleanly, then run these commands with Node 24 and dedicated private paths:

```sh
node app/backup.mjs backup /private/stories/storychat.sqlite /private/backups/stories.json
node app/backup.mjs restore /private/backups/stories.json /private/isolated/storychat.sqlite
```

The helper takes the normal database runtime lock and refuses existing backup/restore destinations. The parent of a restore database must be dedicated to Storychat because permissions are restricted. Linux lock files persist and must never be removed. Backup creates a consistent logical application snapshot, not a raw SQLite file copy. Keep original files until recovery is verified.

Start the isolated restored instance with `STORYCHAT_PROVIDER=fake`, a separate app password, separate database path and separate port. Inspect stories, memories and controls and send a clearly labelled fake turn. Never mount production provider/key volumes into a restoration test. Automated tests use synthetic data and prove this isolated recovery path; they do not verify your external backup storage or disaster recovery procedures.

Provider authorization needs a separate recovery plan. Do not duplicate rotating sessions across hosts or restore old token snapshots and resume them. Recover stories independently, then use supported SSH-assisted sign-in to authorize the intended sole instance. Keep its own persistent host identity and protected provider/key volumes where available. No credentials belong in a story export, ordinary logs, Git or support messages.

Before upgrading, record the current immutable image digest and export a private backup. Keep the existing named volumes. Test restoration into an isolated fake instance. Roll back only with a compatible image/data format; if compatibility is uncertain, restore the pre-upgrade story backup into fresh volumes rather than overwrite a running database. Production upgrade and rollback remain owner actions.


Standalone library transfer: use the character/persona detail export and its library import preview to add one independent item, including its picture. These packages use the existing versioned notebook/media envelope restricted to one library record and no stories. Item import assigns fresh identities; it is not notebook recovery and does not preserve original item IDs, timestamps or library version. Full notebook recovery retains its collision checks. Expanded persona fields require a compatible release. See [refinement update](refinement-update.md).

Thought timeline compatibility: current backups/exports support typed fictional thought messages and validated request history. Portable export omits request contexts/history; offline logical backup retains them. Older releases may reject these stories. Restore a pre-upgrade backup into fresh storage for rollback. See [thought/reading release guide](thought-reading-update.md).
