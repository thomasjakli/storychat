# Running the continuity prototype

Use **Node 24** (tested 24.22.1). No dependency installation or build is required. Run from the repository root. The system Node 18 installation on the development PC does not work; its bundled Node 24 executable is available through the desktop runtime. Standard commands below assume `node` resolves to Node 24.

## Local demo

In PowerShell, choose a unique app password interactively:

```powershell
$storychatPassword = Read-Host 'Owner app password (at least 12 characters)' -AsSecureString
$env:STORYCHAT_PASSWORD = [System.Net.NetworkCredential]::new('', $storychatPassword).Password
$env:STORYCHAT_PROVIDER = 'fake'
node app/server.mjs
```

Open `http://127.0.0.1:8787` on the same computer and enter that app password. Create an original adult character, fictional persona and story. The explicitly labelled fake provider demonstrates favorite-color statements, map promises/delivery, and gratitude; it is a limited deterministic example, not general AI. It makes no network or subscription requests.

Create a character/persona once and reuse them in another story to check isolation. A new story snapshots their definitions. Library editing, portrait uploads, regeneration and export/import are later MVP work. Memory removal leaves source messages intact; story deletion removes that story's logical records and memories while retaining its library definitions. Deleted data may remain in SQLite pages/backups until operational compaction; secure erasure is not claimed.

Stop with Ctrl+C. Clear the password from the shell when finished:

```powershell
Remove-Item Env:STORYCHAT_PASSWORD
$storychatPassword = $null
```

Optional `.env.example` shows the settings; copying it to ignored `.env` requires protecting that file. It is only loaded with `node --env-file=.env app/server.mjs`. Never commit a configured `.env` or put passwords in terminal history. The owner password is separate from ChatGPT consent.

## Owner's ChatGPT connection

Use the existing [local onboarding helper](../prototype/README.md) on the same Windows PC as the consent browser. Stop the app before onboarding, catalog discovery, refresh or revocation, since it owns the credential vault lock for its lifetime.

```powershell
node prototype/cli.mjs auth
node prototype/cli.mjs accounts
node prototype/cli.mjs models <selected-account-id>
$env:STORYCHAT_PROVIDER = 'chatgpt'
$env:STORYCHAT_ACCOUNT_ID = '<selected-account-id>'
$env:STORYCHAT_MODEL = '<a-model-slug-from-that-catalog>'
node app/server.mjs
```

For an existing registration, use `auth <selected-account-id>` instead of creating a new one. Do not paste tokens or callback URLs into chat. Configure one account ID and one model explicitly. ChatGPT is the default mode; missing configuration/sign-in keeps existing stories readable and reports an actionable error. There is no fallback provider or automatic inference retry. Requests use the same owner's ChatGPT allowance. Manage connected sessions and allowance in the provider's settings.

The browser receives app session cookies, never provider credentials. Default encrypted tokens live in ignored `data/provider-spike/`; their separately protected key lives in ignored `secrets/provider-spike/`. `STORYCHAT_DATA_DIR` and `STORYCHAT_KEY_DIR` override those provider paths. Only the server process renews the selected session; do not clone rotating credentials across active processes or hosts. For Docker, follow the [first-deployment guide](first-deployment.md): the handoff helper encrypts a selected session for the destination, disables its source copy and preserves the destination's host identity. Transfer requests and bundles through authenticated SSH; never copy whole vaults or keys.

## Persistence and recovery

SQLite lives at ignored `data/storychat/storychat.sqlite`; `STORYCHAT_DB` may point to a dedicated app data directory. Production startup protects that directory with owner-only Windows ACLs or Unix mode 0700 and creates private files with umask 077. Its parent must be dedicated to this app, since its ACL is changed. Provider secrets remain separate from the story database. Run one server per database. On Linux, `util-linux`'s `flock` guards persistent database/provider lock files and releases ownership after a process crash; **never delete Linux lock files**. On Windows, exclusive marker files remain fail-closed: after a crash, first verify every process using that runtime is gone before removing only the stale marker. Startup marks pending generations interrupted; it never resends a model request automatically.

The app also accepts `STORYCHAT_PASSWORD_FILE` for a mounted UTF-8 owner password file; do not set it together with `STORYCHAT_PASSWORD`. The file is bounded and only its terminal newline is removed. Compose's default Portainer configuration uses `STORYCHAT_PASSWORD`; keep private values outside Git and restrict deployment-manager access.

Completed replies and state commit atomically. A failed turn retains its user message and a safe error; the owner can explicitly use it as a draft for another attempt. Ambiguous HTTP sends can resume with the same request ID. Restart requires app login again; stories and controls remain. Drafts are stored on the browser device and cleared on successful logout. Final narrative appears after completed structured validation; visible incremental narrative streaming is deferred.

The prototype is intentionally bounded. See `project.md` for context and record limits. Suppression matches stable keys and normalized text, not arbitrary paraphrases. Corrections/pins take priority and source IDs are validated; the model still needs quality evaluation because a permitted citation is not proof of a claim.

## Verification

```powershell
node app/test.mjs
node prototype/test.mjs
```

The milestone 3 application suite passes all 44 checks on Linux, with no skips. Windows skips two Linux lifecycle checks. The provider/setup suite passes 62 checks on Linux; Windows skips its Linux launcher check. Actual Linux containers also pass CLI stdin handoff and replay-after-replacement checks. See [deployment verification](deployment-verification.md). All ordinary tests use synthetic data, fake/scripted providers and temporary databases. Windows owner-only ACL tests and local HTTP tests require a runtime outside the restricted desktop sandbox; ACLs must not be weakened to run them.

The optional live evaluation is **never** included in `test`. With an authorized account configured and app stopped, explicitly set `STORYCHAT_LIVE_EVAL=yes` and run `node app/evaluate-live.mjs`. It sends at most four requests, stopping on the first failed assertion, and keeps only synthetic evaluation data under ignored `data/live-evaluation/`. Seven filler turns are deterministic, so it measures live recall of persisted state without spending seven extra requests. Results are a bounded quality sample; no recurring work is scheduled.

## Android acceptance and remote access

The current local preview URL works only on the Windows PC. A phone's loopback address points to the phone. Real Android acceptance needs an existing reachable trusted HTTPS route chosen by the owner; none was configured by this work. For that later route, set `STORYCHAT_HOST` to the intended private binding and `STORYCHAT_ORIGIN` to its exact HTTPS origin. The cookie becomes Secure, Host/Origin checks use that configured origin, and the proxy must preserve the original Host. Do not expose the OAuth callback, vault, or database through the tunnel. Do not replace Access policy checks with arbitrary incoming identity headers.

On the actual Android device, verify owner login; creating character/persona/story; entering a fact and promise; reading the reply; opening source links; correction, pinning and removal; saving all three writing controls; closing/reopening the browser; and resuming after server restart. Record browser/device and results. Home-screen installation, virtual keyboard/background/stream recovery and actual Docker/Tunnel checks remain milestone 3. No service worker caches private data; the manifest and original SVG are groundwork, not proof of Android installability.

No Docker host, tunnel, DNS, public service, paid fallback or recurring model workload is provisioned by this prototype.

## Container preparation

See [container packaging](../deploy/README.md) and the [first-deployment guide](first-deployment.md) for the Compose stack, Portainer settings, encrypted credential handoff and activation. The public template contains no instance network topology or credentials. GitHub workflow verification and image publication are separate from deploying that image to the owner's host. Actual-owner handoff and real Android acceptance remain separate steps.

The verified handoff release is publicly retrievable using either its source-commit tag or digest:

```text
ghcr.io/thomasjakli/storychat:sha-a47c64bbae6f40d8f91e9f003b1b1a66411421e0
ghcr.io/thomasjakli/storychat@sha256:15754aa0a2cddac92adc53a3b57e02fd6f7a7f8ceae9e9969cf55ae3f9069440
```

Use this digest as `STORYCHAT_IMAGE` to pin the tested artifact. Follow the first-deployment guide with account/model initially empty, then import and activate the selected owner session. The image contains no ChatGPT credentials; host onboarding and Portainer deployment are still required.

## Milestone 3 features

The owner reports successful deployed milestone 2 acceptance on Android Firefox. New library management, latest-turn editing/regeneration, portable export/import and offline lossless backup/restore are described in [milestone 3 verification](milestone-3-verification.md), [recovery](backup-restore.md) and [upgrade/device checks](milestone-3-upgrade.md). Existing historical turns without a rollback baseline cannot be regenerated; new turns support safe replacement. No automatic model retry or provider change is introduced.
