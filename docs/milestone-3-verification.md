# Milestone 3 verification

Reviewed 2026-10-30. Ordinary checks use original synthetic fixtures and fake/scripted providers. No production database, provider credentials, host infrastructure or live inference was accessed for this work.

## Independent evidence

`node --test app/tests/m3-qa.test.mjs app/tests/backup.test.mjs` passes four checks on Windows Node 24. The independent replacement scenario pins and unpins a memory, begins replacement, reopens the database, verifies interruption, refuses stale completion, deletes the fact, retries replacement and checks suppression and story isolation. Backup checks restore into an isolated database, retain replacement history, regenerate safely, continue with fake inference, refuse existing destination files, reject unknown credential fields and forged context, and reject import collisions atomically.

The coordinator's HTTP checks additionally cover owner authentication, snapshot-preserving library edits, duplicate definitions, replacement request replay, export/import collision refusal, and absence of internal rollback snapshots from generation responses. Store checks cover archived definitions, retained story snapshots, all derived-state rollback categories, owner correction/pin preservation, stale revisions and legacy turn refusal.

## Container coverage

The runtime allowlist contains 22 files, including the backup and transfer modules. The actual-container smoke harness adds an isolated, network-disabled, fake-provider backup/restore scenario with no production mounts. It compares restored state, then replaces a turn and checks that superseded extracted facts disappear. The outer harness parses under Node 24. Actual execution of this new stage is pending Linux CI; syntax and local tests do not establish a container pass.

## Acceptance still requiring the owner

Milestone 2's deployed live ChatGPT and Android Firefox checks were reported by the owner and are recorded separately. Milestone 3's new editing/regeneration and library flows, home-screen installation, keyboard layout, background/reconnect behavior and upgrade checks require device/deployment acceptance after the tested release is installed. Agents have not altered the running installation.

No passing fake-provider test establishes semantic reliability of arbitrary live replies. Model access and supported authentication remain unchanged; there is no billed fallback or automatic inference retry. Portable web export omits generation history; the dedicated logical backup preserves validated history for recovery. Legacy turns created before rollback snapshots cannot be regenerated safely and fail actionably. Backups contain private story content and must be protected by the owner; provider authorization requires separate recovery.
