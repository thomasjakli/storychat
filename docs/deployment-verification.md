# Container deployment verification

Reviewed 2026-10-30 by the independent Quality and Continuity Tester role.

## Current evidence

The Docker smoke harness parses successfully under bundled Node 24.22.1. Packaging and runtime contracts were inspected together: exact runtime-source copies, a deny-by-default Docker context, UID/GID 1000, dedicated mode-0700 persistent directories, read-only root filesystem, an original health check, and Linux `flock` support. Local `docker info` cannot connect because the development machine has no running Docker daemon. **No local image build or container test pass is claimed.** Actual Linux CI evidence was subsequently inspected and is recorded below.

The harness is `deploy/container-smoke.mjs`. It accepts `STORYCHAT_TEST_IMAGE` for a prebuilt image, or builds a uniquely tagged `linux/amd64` image itself. It requires a Linux Docker engine and Node 24. It is explicitly separate from ordinary application tests. For example:

```sh
STORYCHAT_TEST_IMAGE=storychat:verification node deploy/container-smoke.mjs
```

`STORYCHAT_SMOKE_ARTIFACT_DIR` optionally selects a result/log directory; otherwise the script uses an isolated OS temporary directory. No real credentials, existing named volumes, production host configuration, or ChatGPT requests are used. All test containers use `--network none`; HTTP checks run inside the container with `node:http` and the expected synthetic Host header.

## Checks implemented

| Area | Assertions |
| --- | --- |
| Image and architecture | Linux amd64 metadata, explicit non-root user, exact approved `/app` file set. Analysis, screenshots, tests, live evaluation scripts, repository metadata, dotenv files and runtime credentials must be absent. |
| Filesystem | UID 1000; writing the image filesystem fails with a read-only root; fresh story/provider/key directories have owner 1000 and mode 0700; SQLite permissions exclude group/other access. |
| Password file | A temporary mode-0600 synthetic owner password file is used through `STORYCHAT_PASSWORD_FILE`; service configuration does not contain the plaintext password. |
| Authentication | Unauthorized library access is rejected; login succeeds and issues Secure/HttpOnly cookies for the configured synthetic HTTPS origin. |
| Application state | Create original synthetic character/persona/story; one explicitly fake turn produces sourced fact, pending promise, relationship and authored thought; response hides internal generation context. |
| Owner corrections | Correct and pin the fact, save independent writing controls, then compare durable state across lifecycle operations. |
| Graceful restart | Container restart preserves memories, relationship, plan, controls, revision and summary; old app sessions no longer authenticate. |
| Exclusivity | A second application process/container using the same story volume is refused while the first remains healthy. |
| Forced termination | SIGKILL followed by restart succeeds without deleting persistent Linux advisory-lock files. |
| Interrupted attempt | A stopped server's synthetic database is seeded with a pending attempt; startup marks it interrupted without applying new state or issuing inference. |
| Replacement | Remove the application container and recreate it with the same named volumes; previously corrected/pinned state and interrupted status remain. |
| Provider-vault lifecycle | A separate synthetic encrypted vault refuses a concurrent holder, survives SIGKILL of its first holder, reacquires the same persistent lock, decrypts fake credentials, and saves a replacement fake token. Ciphertext must omit the known plaintext marker and the key must have mode 0600. This tests storage/locking, not provider acceptance. |
| Encrypted CLI handoff | The current harness prepares a recipient request, exports one synthetic source registration, imports it through the actual CLI's bounded stdin route, inspects sanitized account status, and verifies source disconnection and destination host preservation. After a further container replacement, the consumed ledger and rotated synthetic token survive and identical-bundle replay remains a harmless no-op. This added stage requires its own Linux CI pass. |

The script creates randomly named containers/volumes bearing a per-run label. Cleanup targets only exact names created during that invocation with the matching label. Failed synthetic container logs and a sanitized result record remain in the artifact directory; cleanup is best effort if the daemon itself becomes unavailable. It does not prune unrelated resources or remove an input image.

## Independent review findings

The first smoke draft used `fetch` with a Host override. The coordinator identified runtime-dependent handling of that header, so the harness now uses `node:http` explicitly, matching the health check. The application now uses umask 077 before SQLite creation so private file-mode assertions do not rely solely on parent-directory protection. Linux lock inodes are persistent; the harness verifies reacquisition instead of expecting marker deletion.

These are verification preparations, not deployed evidence. Actual selected-host volume ownership, persistent-lock behavior, shutdown/restart, image contents and replacement require the Linux Docker run. No private ingress topology belongs in this public report.

Final pre-CI review caught an escaped regular expression inside an embedded Node script that would have been altered by JavaScript template-string processing. That fragment now uses `String.raw`; all seven embedded modules were syntax-checked independently with Node 24, alongside the outer harness. This still does not substitute for actual container execution.

The workflow was reviewed for publication boundaries: verification uses read-only repository permission; pull requests cannot publish; publication depends on successful verification, independently rebuilds and smoke-tests the exact candidate it pushes, and only then uses the job token's package-write permission. Checkout credential persistence is disabled and actions are pinned. No Actions caches, artifact uploads, larger runners or deployment commands are configured. Targeted inspection of new packaging/workflow/test candidates found no private network topology or obvious token/private-key literals; existing ignore checks continue to exclude research, screenshots, dotenv configuration, runtime credentials and encryption keys. No actual credential file was inspected.

## Remaining gates

- Deploy the selected image on the owner's actual host and verify its protected storage, origin routing and owner-only access separately.
- Complete supported same-owner ChatGPT session handoff and bounded actual-host provider checks; the synthetic vault test does not transfer or authorize a real session.
- Complete real Android creation/chat/memory acceptance through the owner's chosen route. No container or desktop test establishes Android keyboard, background recovery, or home-screen installation.

## Prior Linux CI outcome — container baseline

The reviewer independently fetched and inspected job logs from [workflow run 41102134906](https://github.com/thomasjakli/storychat/actions/runs/41102134906), for commit `db6d88ef3453f672c634e59478b1e127b9897a6c`, on 2026-10-30. Log inspection was limited to test summaries, smoke stages, build warnings and publication results; no provider credentials or private runtime files were requested.

The Linux verify job `124220981852` reports Node 24.22.2, **33 application tests passed, 0 failed, 0 skipped**, and **48 subscription-adapter tests passed, 0 failed, 0 skipped**. Compose validation and Linux amd64 image build passed. The actual container smoke completed every implemented stage: exact runtime-only image, non-root/read-only filesystem, password-file authentication, fake narrative state, correction/pinning/controls, graceful restart, concurrent-runtime refusal, SIGKILL recovery, interrupted-attempt recovery, replacement-volume persistence, and synthetic encrypted-vault exclusivity/recovery. No live inference occurred.

The publication job `124221334997` independently rebuilt its candidate and passed the same actual container smoke before pushing:

```text
ghcr.io/thomasjakli/storychat:sha-db6d88ef3453f672c634e59478b1e127b9897a6c
sha256:aea134ae5b9cb7796f1ef202853ec868dd3dada39461d51bdf3618e5bf6f014c
```

Both build logs contain a BuildKit `SecretsUsedInArgOrEnv` heuristic warning for `STORYCHAT_KEY_DIR`. Review confirms that value is a public directory path, not encryption-key material; no key or credentials were supplied to the build. The warning was not suppressed.

Separately, the coordinator reports an anonymous GHCR manifest/config probe matching that digest and confirming Linux amd64 and UID 1000. This reviewer verified the workflow build/smoke/push logs, not that separate anonymous registry probe. A published and tested image does not establish deployment on the owner's VM, actual protected-volume configuration, trusted ingress, provider-session handoff, backups, or Android acceptance; those remain separate gates.

## Encrypted handoff revision — local evidence

The subsequent revision adds `prototype/handoff.mjs` to the runtime allowlist, changing the exact image file count from 17 to 18. The smoke harness now contains nine embedded Node modules; all nine and the outer module pass independent syntax checks. Its actual CLI handoff stage uses a fresh ephemeral synthetic source and a separate target inside the generated provider/key volumes. Every container remains network-isolated; no real account, provider authorization, revocation, or inference is used.

On Windows with bundled Node 24.22.1 outside the managed sandbox, the full `node prototype/test.mjs` suite passed **58 tests, 0 failed, 0 skipped**. Ten new handoff scenarios include three independently authored adversarial cases. Checks cover recipient/host binding, selected-account movement without altering another registration, encrypted bundle/journal contents, tampering, invalid/expired input, active-runtime refusal, pre-existing destination credentials, safe publication, interrupted export recovery, lost recipient keys, and replay after token rotation. Both original source and destination host identities remain unchanged. Failed publication disconnects the selected source once and retains identical recovery ciphertext; repeated publication is idempotent. Identical consumed-bundle import is an explicit no-op and cannot restore stale tokens.

Final independent review found one source-reauthorization edge: retrying an old export journal after the source had acquired fresh credentials could republish stale ciphertext while incorrectly reporting that the source was disconnected. The implementation now refuses that retry before mutation/publication with `handoff_source_active`. Both the independent scenario and a dedicated regression verify preservation of the new source credentials and existing output; this fix is included in the 58-test passing run.

Code review confirms RSA-3072 OAEP/SHA-256 with AES-256-GCM and authenticated recipient/lifetime headers, bounded input, an encrypted source journal committed atomically with local token removal, and an encrypted destination replay ledger committed with credentials before private-key deletion. Request/bundle transport still requires an authenticated channel: encryption does not authenticate a substituted recipient request. Those are bounded original implementation checks, not a claim of a general cryptographic audit.

The earlier Linux baseline run above does **not** verify this new handoff revision. Its Linux build/smoke/publication outcome is pending; real same-owner credential transfer, actual-host provider renewal, owner ingress, backups, and Android acceptance remain unverified.
