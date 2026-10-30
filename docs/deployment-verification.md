# Container deployment verification

## SSH setup revision — pending Linux execution

The SSH setup revision adds a non-secret saved connection selection and a host-side authorization launcher. Independent application checks pass two scenarios: saved selection loads only when both environment fields are empty, startup performs catalog discovery without inference, partial explicit configuration cannot mix with saved values, and malformed settings fail before vault/network access. The runtime image allowlist now includes `prototype/connection.mjs` and `deploy/connect-chatgpt.sh` (20 files).

These local synthetic checks do not verify a real SSH connection, browser consent, owner-host authorization, or the new image in Linux Docker. Prior release results below remain historical evidence until this revision passes CI.

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
| Encrypted CLI handoff | The current harness prepares a recipient request, exports one synthetic source registration, imports it through the actual CLI's bounded stdin route, inspects sanitized account status, and verifies source disconnection and destination host preservation. After a further container replacement, the consumed ledger and rotated synthetic token survive and identical-bundle replay remains a harmless no-op. This stage passed both Linux CI container runs for the handoff release below. |

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

The earlier Linux baseline run above does **not** verify this new handoff revision. Separate Linux evidence for the handoff release follows; real same-owner credential transfer, actual-host provider renewal, owner ingress, backups, and Android acceptance remain unverified.

## Current Linux CI outcome — encrypted handoff release

Independent log inspection confirms [workflow run 41107642425](https://github.com/thomasjakli/storychat/actions/runs/41107642425), commit `6ac9e6ec3b4ce17afffefbeebe314fdc4c1e3bed`, passed the verification stage with Node 24.22.2: **33 application tests and 58 provider/handoff tests passed, 0 failed, 0 skipped**. Verify job `124241558124` built the Linux amd64 image and passed every container stage, including the actual CLI encrypted export/import, stdin import, sanitized status, persistent consumed ledger, and replay after replacement without overwriting a rotated synthetic token. The exact 18-file runtime boundary and non-root/read-only restrictions passed.

This result followed a failed candidate run, [41107326563](https://github.com/thomasjakli/storychat/actions/runs/41107326563), whose application suite found a startup readiness race before provider tests or image publication. The server printed readiness before registering signal handlers, allowing an immediate SIGTERM to terminate by signal. The coordinator moved readiness after handler installation. Independent QA strengthened the existing Linux regression to assert both handlers are installed before readiness and perform three start/SIGTERM/lock-reacquisition cycles on the same database. The corrected Linux run passed this regression; the failure was fixed rather than retried unchanged.

Publication job `124241821893` independently rebuilt and passed the complete smoke again before pushing the tested image:

```text
ghcr.io/thomasjakli/storychat:sha-6ac9e6ec3b4ce17afffefbeebe314fdc4c1e3bed
sha256:fccec0160036496da7ca72d54a64b630d0a73a184faada5c55c7646a6bd0a84d
```

These are independently observed workflow build/test/push results. They use generated synthetic credentials and network-isolated test containers, with no live provider calls. The `STORYCHAT_KEY_DIR` public-path BuildKit heuristic warning remains visible. The actual owner deployment and Android gates listed above remain open; publishing this image does not imply that either was tested.

SSH release a47c64bbae6f40d8f91e9f003b1b1a66411421e0: Linux CI run 41121879152 passes 35 application and 62 provider/setup tests with no skips. Both container smoke runs passed. Published digest sha256:15754aa0a2cddac92adc53a3b57e02fd6f7a7f8ceae9e9969cf55ae3f9069440 anonymously retrieves as Linux/amd64 UID 1000. Launcher tests use mock Docker; actual owner SSH forwarding and browser consent remain unverified.
