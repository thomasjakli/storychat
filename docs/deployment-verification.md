# Container deployment verification

Reviewed 2026-10-30 by the independent Quality and Continuity Tester role.

## Current evidence

The Docker smoke harness parses successfully under bundled Node 24.22.1. Packaging and runtime contracts were inspected together: exact runtime-source copies, a deny-by-default Docker context, UID/GID 1000, dedicated mode-0700 persistent directories, read-only root filesystem, an original health check, and Linux `flock` support. Local `docker info` cannot connect because the development machine has no running Docker daemon. **No local image build or container test pass is claimed.** Linux CI results must be recorded separately below when available.

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

The script creates randomly named containers/volumes bearing a per-run label. Cleanup targets only exact names created during that invocation with the matching label. Failed synthetic container logs and a sanitized result record remain in the artifact directory; cleanup is best effort if the daemon itself becomes unavailable. It does not prune unrelated resources or remove an input image.

## Independent review findings

The first smoke draft used `fetch` with a Host override. The coordinator identified runtime-dependent handling of that header, so the harness now uses `node:http` explicitly, matching the health check. The application now uses umask 077 before SQLite creation so private file-mode assertions do not rely solely on parent-directory protection. Linux lock inodes are persistent; the harness verifies reacquisition instead of expecting marker deletion.

These are verification preparations, not deployed evidence. Actual selected-host volume ownership, persistent-lock behavior, shutdown/restart, image contents and replacement require the Linux Docker run. No private ingress topology belongs in this public report.

Final pre-CI review caught an escaped regular expression inside an embedded Node script that would have been altered by JavaScript template-string processing. That fragment now uses `String.raw`; all seven embedded modules were syntax-checked independently with Node 24, alongside the outer harness. This still does not substitute for actual container execution.

The workflow was reviewed for publication boundaries: verification uses read-only repository permission; pull requests cannot publish; publication depends on successful verification, independently rebuilds and smoke-tests the exact candidate it pushes, and only then uses the job token's package-write permission. Checkout credential persistence is disabled and actions are pinned. No Actions caches, artifact uploads, larger runners or deployment commands are configured. Targeted inspection of new packaging/workflow/test candidates found no private network topology or obvious token/private-key literals; existing ignore checks continue to exclude research, screenshots, dotenv configuration, runtime credentials and encryption keys. No actual credential file was inspected.

## Remaining gates

- Record the Linux CI build and smoke outcome, including the tested commit/image reference.
- Deploy the selected image on the owner's actual host and verify its protected storage, origin routing and owner-only access separately.
- Complete supported same-owner ChatGPT session handoff and bounded actual-host provider checks; the synthetic vault test does not transfer or authorize a real session.
- Complete real Android creation/chat/memory acceptance through the owner's chosen route. No container or desktop test establishes Android keyboard, background recovery, or home-screen installation.

## Linux CI outcome

Pending. This section must be updated from actual workflow evidence; do not infer a pass from the presence of the harness or static packaging review.
