# Milestone 3 verification

Reviewed 2026-10-30. Ordinary checks use original synthetic fixtures and fake/scripted providers. No production database, provider credentials, host infrastructure or live inference was accessed for this work.

## Published release

The corrected commit `a96b01b0433a141bebe98157ae9b2374f60c4e76` passed [workflow 41126200780](https://github.com/thomasjakli/storychat/actions/runs/41126200780): 44 application tests and 62 provider/setup tests, no failures or skips. Verification job `124305490720` and publication job `124305706080` each passed actual container smoke including isolated fake backup/restore and regeneration. Publication pushed `ghcr.io/thomasjakli/storychat@sha256:b8cabe320b1dacc3047a18d53834a1e826a0cb5f3bcc7fbd36623a18e1000ef5`; anonymous manifest/config retrieval confirmed Linux/amd64 and UID/GID 1000. Desktop browser checks used an isolated fake preview and verified creation, chat, latest-message replacement with rebuilt memory and character duplication. These are not Android results.

## Independent evidence

`node --test app/tests/m3-qa.test.mjs app/tests/backup.test.mjs` passes four checks on Windows Node 24. The independent replacement scenario pins and unpins a memory, begins replacement, reopens the database, verifies interruption, refuses stale completion, deletes the fact, retries replacement and checks suppression and story isolation. Backup checks restore into an isolated database, retain replacement history, regenerate safely, continue with fake inference, refuse existing destination files, reject unknown credential fields and forged context, and reject import collisions atomically.

The coordinator's HTTP checks additionally cover owner authentication, snapshot-preserving library edits, duplicate definitions, replacement request replay, export/import collision refusal, and absence of internal rollback snapshots from generation responses. Store checks cover archived definitions, retained story snapshots, all derived-state rollback categories, owner correction/pin preservation, stale revisions and legacy turn refusal.

## Container coverage

Further independent review reproduced a corrected-fact deletion bug: regenerating a later turn restored a corrected memory from its rollback snapshot even though the owner had subsequently deleted it. Deletion suppression now takes precedence over the correction exemption. A regression establishes the corrected fact before the target turn, deletes it afterward, then verifies replacement context and completion do not resurrect it. Five focused QA/store checks pass with that fix.

The runtime allowlist contains 22 files, including the backup and transfer modules. The actual-container smoke harness adds an isolated, network-disabled, fake-provider backup/restore scenario with no production mounts. It compares restored state, then replaces a turn and checks that superseded extracted facts disappear.

Independent inspection of verify-job logs `124305490720` from [workflow run 41126200780](https://github.com/thomasjakli/storychat/actions/runs/41126200780), commit `a96b01b0433a141bebe98157ae9b2374f60c4e76`, confirms **44 application tests and 62 provider/setup tests pass, with no failures or skips**, on Linux Node 24. The actual container smoke passed every stage, including runtime boundaries, non-root/read-only operation, authentication, restart/replacement persistence, forced termination recovery, encrypted handoff and the new isolated logical backup/restore plus replacement scenario. These are actual Linux/container results, not inferred from local syntax checks. Publication is verified separately by the coordinator.

## Owner acceptance and deferred recovery checks

Milestone 2's deployed live ChatGPT and Android Firefox checks were reported by the owner and are recorded separately. The owner subsequently updated the deployment and reports fully passing milestone 3 manual groups 1–4, covering editing/regeneration, library flows, installation/usability, interruption/restart and logout. Agents did not observe the device or alter the running installation.

No passing fake-provider test establishes semantic reliability of arbitrary live replies. Model access and supported authentication remain unchanged; there is no billed fallback or automatic inference retry. Portable web export omits generation history; the dedicated logical backup preserves validated history for recovery. Legacy turns created before rollback snapshots cannot be regenerated safely and fail actionably. Backups contain private story content and must be protected by the owner; provider authorization requires separate recovery.

Owner acceptance, 2026-10-30: manual groups 1–4 fully passed according to the owner. Export/recovery group 5 was partially tested; its remaining checks are explicitly deferred, non-blocking follow-up. The specific completed subset was not reported. Milestone 3 is complete by owner acceptance. Incremental visible answer streaming is not required for now; validated completed replies are accepted. These are owner-reported results, distinct from automated evidence. No reminder automation was requested or created.
