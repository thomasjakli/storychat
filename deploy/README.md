# Container packaging

The image runs the single-owner application on Linux/amd64 using Node 24 and built-in SQLite. Compose supplies an HTTP origin service behind an owner-managed HTTPS route. It creates no tunnel, proxy, DNS records, provider authorization or paid resources.

The exact base is `node:24.22.2-bookworm-slim`, present for amd64 in the [Docker Official Images manifest](https://github.com/docker-library/official-images/blob/master/library/node) when checked on 2026-10-30. This is a maintained patch update from the local Node 24.22.1 test runtime. `util-linux` is installed explicitly for `flock`; its availability is asserted during build. Container execution and patch compatibility must pass the release checks before publishing an image.

## Image contents and build

The deny-by-default `.dockerignore` and explicit `COPY` instructions include only the application, provider transport/onboarding modules, static interface and health script. Research, screenshots, APKs, tests, live evaluations, environment files, Git history, databases, credentials and backups are excluded. Do not replace these rules with `COPY . .` or pass secrets as build arguments. Docker filters the build context before sending it to the builder. [Build context documentation](https://docs.docker.com/build/concepts/context/)

On a machine with an available Docker daemon, build a review image from the repository root:

```sh
docker build --platform linux/amd64 --tag storychat:review .
```

This command builds locally; it does not publish. Use the release workflow and a reviewed tag or digest for deployment. The image contains no credential session or password. No dependency-install step or frontend build is needed.

## Compose settings

Configure these in the deployment manager's private environment settings, not in committed source:

| Variable | Meaning |
| --- | --- |
| `STORYCHAT_IMAGE` | Required explicit release tag or immutable digest; no implicit latest |
| `STORYCHAT_ORIGIN` | Required trusted HTTPS origin, for example `https://stories.example.com`, without a path |
| `STORYCHAT_PASSWORD` | Required unique owner app password, 12–256 characters; separate from ChatGPT sign-in |
| `STORYCHAT_BIND_ADDRESS` | Published host interface, default `127.0.0.1`; select a reachable private interface only when the existing ingress needs it |
| `STORYCHAT_PORT` | Published host port, default `8787`; internal application port remains `8787` |
| `STORYCHAT_PROVIDER` | Defaults to `chatgpt`; `fake` is an explicitly labelled synthetic test mode |
| `STORYCHAT_ACCOUNT_ID` | One authorized owner registration ID from supported onboarding |
| `STORYCHAT_MODEL` | One model selected from the authorized catalog |

Missing provider configuration allows inspection of the UI and saved stories but cannot generate live replies. There is no paid or fake fallback. Health checks perform no model calls. Provider authorization and credential handoff are separate deployment steps; copying the Compose file does not connect an account.

Environment variables may be visible to host/container administrators and the deployment manager. Restrict that administrative access. Do not paste expanded `docker compose config`, container environment dumps, or passwords into issue reports or logs. Validate configuration privately using `docker compose config --quiet` with the required variables already present.

The default loopback binding is suitable only when the existing ingress can reach the host loopback. A connector in another network namespace cannot reach this socket merely by using its own `localhost`. Choose the private interface or shared-network routing appropriate to that installation, and keep the HTTP upstream off public interfaces. The application binds `0.0.0.0` only inside its container and rejects requests whose Host does not match the configured origin. The existing ingress must preserve the origin Host and enforce its chosen owner-only policy; application login remains required.

## Persistence and permissions

Compose uses three named volumes:

| Volume | Container path | Contents |
| --- | --- | --- |
| `story-data` | `/var/lib/storychat/stories` | SQLite database, journal and runtime lock |
| `provider-data` | `/var/lib/storychat/provider` | Encrypted provider record, stable host identity and runtime lock |
| `provider-key` | `/var/lib/storychat/keys` | Provider encryption key, protected separately from the encrypted record |

The image prepares all three directories as UID/GID `1000:1000`, mode `0700`, before mounting volumes. Docker initializes a new empty named volume from its image mountpoint; retain normal copy-up behavior. This avoids a root application process or a privileged ownership initializer. Existing volumes retain their existing ownership; migrations from bind mounts or incompatible ownership need explicit administrator preparation. Do not use `volume-nocopy` for initial provisioning. [Docker volume lifecycle and population](https://docs.docker.com/engine/storage/volumes/)

The application runs as UID/GID 1000 with a read-only root filesystem, dropped capabilities, no-new-privileges and a bounded temporary filesystem. It never needs a Docker socket. Do not override the service to root to work around incorrectly owned storage. Only one active server may own a story database/provider session; do not scale replicas or clone live provider volumes between hosts. Linux advisory locks release with process termination, while their persistent lock files may remain. Never delete a lock file to bypass a process that still owns the runtime.

Back up story data consistently and encrypt private backups. For a simple offline backup, stop the stack cleanly, archive the story volume including any SQLite journal files, and then restart. Validate restoration to an isolated instance. Provider credential/key backup and recovery are a separate procedure: a restored stale rotating refresh token may require supported reauthorization. Never start a test restoration with production provider credentials. Do not run `docker compose down --volumes` or remove named volumes during ordinary upgrades.

## Lifecycle and verification

Compose forwards termination through its init process and allows 150 seconds for shutdown, longer than the bounded 120-second provider request deadline. An abrupt stop can leave an interrupted story attempt; it must not create completed state or trigger automatic inference on restart. Container replacement preserves named volumes. The image health probe requests `/health` locally with the configured origin's Host header, so it respects Host validation without needing an authentication cookie.

Before a release, run the container smoke suite described in the deployment-verification report. Verify non-root permissions, clean image contents, read-only operation, health, restart after forced termination, replacement persistence and blocked unauthorized requests using synthetic data. A passing local HTTP smoke suite does not verify the owner's actual ingress, HTTPS sessions, Android behavior, provider-session handoff or backups. Those require separate checks on the intended installation.

## GitHub image workflow

`.github/workflows/container.yml` runs synthetic application/provider checks and builds/tests a Linux amd64 image on relevant pushes to `master`, pull requests, or manual dispatch. Publication runs only for `master` outside pull requests, after verification. The publication job independently tests the exact image it pushes to `ghcr.io/<owner>/<repository>:sha-<full-commit-sha>`. No mutable `latest` tag or production redeployment is created. Use the recorded registry digest or full commit tag in `STORYCHAT_IMAGE`.

The checkout and Node setup actions are pinned to reviewed commit SHAs. Verification has read-only repository permissions; only publication receives `packages: write` using the job's built-in `GITHUB_TOKEN`. Neither job receives provider sessions, an owner app password, private conversations or host settings. Tests explicitly select the fake provider and use synthetic fixtures. No live-model evaluation is run in CI.

Workflows are restricted to public repositories and standard `ubuntu-24.04` runners. No larger runners, caches or retained Actions artifacts are configured. Standard runners in public repositories and GHCR container storage/bandwidth are currently free, per GitHub documentation checked on 2026-10-30; no billing settings are changed. Reassess if repository visibility or provider billing policies change. [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [Packages billing](https://docs.github.com/en/billing/concepts/product-billing/github-packages).

New GHCR packages may initially require authentication even when their source repository is public. Verify anonymous pulling separately; if needed, the owner can set package visibility to Public in GitHub's package settings, or configure a narrowly scoped registry credential in Portainer. Never make provider secrets part of a package to enable deployment. A successful push proves image publication, not anonymous availability or a deployed owner instance.
