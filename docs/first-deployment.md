# First personal deployment

This guide prepares one owner-only Linux/amd64 Docker instance managed by Portainer. Commands use a generic SSH alias, `storychat-host`, and example origin, `https://stories.example.com`; substitute your own values privately. Nothing here provisions ingress, changes DNS, publishes a service or enables a separately billed provider.

Container packaging and synthetic Linux checks have passed CI. A real owner's first-host transfer, HTTPS route, owner-only edge policy and Android acceptance still need verification on the intended installation. An encrypted handoff test is evidence for the mechanism, not proof of a live subscription session on your host.

## Recommended: SSH-assisted connection

Use a release containing `deploy/connect-chatgpt.sh` and `connect-ssh`; the earlier handoff image shown below predates this feature. Keep `STORYCHAT_ACCOUNT_ID` and `STORYCHAT_MODEL` empty in Portainer. The app reads the model/account selection saved by this setup when both overrides are empty.

After deploying the stack and checking its HTTPS login, run from the matching repository checkout on your Windows PC:

```powershell
.\deploy\connect-chatgpt.ps1 -HostAlias storychat-host -Container storychat
```

Replace the SSH alias and container name with your private values. Existing authenticated SSH access and Docker administration permission are required. Verify the SSH host key; do not bypass its checks. No local Node installation is required for this route.

Keep the terminal open, open the printed OpenAI link in a browser on that PC, complete consent, then choose a model from the authorized catalog in the terminal. The script temporarily stops the application, authorizes in a same-image non-root helper, saves the selection in its existing provider volume and restarts the application. It makes no inference request. Reopen the app afterward and perform one short explicit live test if desired.

The temporary SSH forward binds only PC loopback. The helper uses Linux host networking so its callback can bind host loopback; no callback port is published through ingress. Only provider/key volumes are mounted in that helper. Credentials originate and remain on the server. The launcher does not change Portainer settings, DNS, proxy routes or the tunnel. Storychat is unavailable during authorization; normal exits, cancellation and helper failures attempt to restart the original container. After a lost connection or host failure, check container status in Portainer and start it if needed.

If port 1455 is occupied, add `-Port 1456` (or another free port). To explicitly reuse a registration, add `-Account <saved-account-id>`; `-Account new` requests a new registration. Never paste tokens or callback URLs into support chats. The provider's exact loopback callback and validation remain unchanged. SSH forwarding is documented for remote Codex authentication; applying that transport to this app is separately tested, without reusing Codex credentials. [Loopback authorization](https://developers.openai.com/siwc/token-sharing-open-source/sign-in), [SSH forwarding](https://learn.chatgpt.com/docs/auth#fallback-forward-the-localhost-callback-over-ssh).

Device-code authentication is documented for Codex, but its credentials are not documented as interchangeable with this app's SIWC connection. The application retains its direct supported adapter. The manual encrypted-transfer procedure below remains an alternative recovery/onboarding route; it is not needed for SSH-assisted setup.
## 1. Choose a verified release

Use the public [source repository](https://github.com/thomasjakli/storychat). Find a successful Container verification workflow run for a commit containing the handoff helper, and record its published immutable image digest. Set `STORYCHAT_IMAGE` to `ghcr.io/thomasjakli/storychat@sha256:<verified-digest>` or that run's full `sha-<commit>` tag. The earlier initial container release does not include handoff commands; do not assume every historical image supports this guide.

The handoff release verified on 2026-10-30 is:

```text
ghcr.io/thomasjakli/storychat@sha256:fccec0160036496da7ca72d54a64b630d0a73a184faada5c55c7646a6bd0a84d
```

[Verification and publication run](https://github.com/thomasjakli/storychat/actions/runs/41107642425). It passes synthetic Linux application, provider and actual-container handoff checks; actual-owner authorization on the deployment host remains separate.

Check that the host is Linux/amd64, Docker is working, Portainer manages its Docker Standalone environment, storage has space, and authenticated SSH/SCP access is available from the Windows PC. Use an existing SSH configuration/host alias and verify its host key through your usual trusted channel. Access to the Docker daemon is administrative access; do not expose its socket to this application.

Keep a password manager entry for a unique owner app password of 12–256 characters. This password is distinct from OpenAI account consent. Enter it directly into Portainer's private environment settings; do not type it as a literal shell command or commit it to a repository.

## 2. Create the Portainer stack

In the intended Docker Standalone environment, choose **Stacks → Add stack → Git repository**. Use:

| Setting | Value |
| --- | --- |
| Stack name | A stable name such as `storychat` |
| Repository URL | `https://github.com/thomasjakli/storychat` |
| Repository reference | `refs/heads/master`, or your reviewed deployment reference |
| Compose path | `compose.yaml` |
| Repository authentication | Not required for this public repository |
| Automatic updates/webhooks | Leave disabled; roll out reviewed versions manually |

Add environment values privately. Repository variables are substituted without editing the tracked Compose file. [Portainer Git stack documentation](https://docs.portainer.io/user/docker/stacks/add)

| Variable | Initial value |
| --- | --- |
| `STORYCHAT_IMAGE` | Verified image digest or full commit tag from step 1 |
| `STORYCHAT_ORIGIN` | Your exact trusted HTTPS origin, no path |
| `STORYCHAT_PASSWORD` | Owner app password, entered privately |
| `STORYCHAT_BIND_ADDRESS` | Host interface reachable only by your intended ingress; default loopback `127.0.0.1` |
| `STORYCHAT_PORT` | Chosen free private upstream port; generic default `8787` |
| `STORYCHAT_PROVIDER` | `chatgpt` |
| `STORYCHAT_ACCOUNT_ID` | Leave empty for initial handoff preparation |
| `STORYCHAT_MODEL` | Leave empty for initial handoff preparation |

Deploy and wait for the container to become healthy. Confirm the published image is reachable by your Docker host; configure registry access only if required. The unconfigured ChatGPT connection intentionally leaves saved-story browsing available and displays a configuration notice. Health does not call a model. The application remains non-root with a read-only image and three writable named volumes.

The stack should have one running application container. Record its container name privately. In VM command examples below, replace `replace-with-container-name` once:

```sh
storychat_container='replace-with-container-name'
docker exec "$storychat_container" node deploy/healthcheck.mjs
```

Exit code zero confirms application health, not provider access. Keep the same stack name and named volumes during upgrades. Do not delete volumes or scale replicas.

## 3. Verify the existing HTTPS route before moving credentials

Configure the existing owner-managed ingress to the private HTTP upstream; preserve the browser's original Host header. Keep the origin/database/provider directories inaccessible to the public network. A routed hostname alone is not an owner-only access policy: verify the intended allow and deny behavior separately, then verify app login at the HTTPS origin.

The Compose loopback binding works only if the ingress can reach that host's loopback. If it runs in another network namespace, use the explicitly selected private routing arrangement rather than its own `localhost`. The app listens on internal container port 8787 and uses secure app cookies when its origin is HTTPS. Do not expose the loopback OAuth callback through ingress.

On the Windows PC, open the selected HTTPS origin, enter the owner app password and confirm the notebook loads with a ChatGPT configuration notice. Check that an unauthorized browser cannot read `/api/library`. Log out and verify the notebook locks. Resolve TLS, Host/Origin, or access-policy errors before transferring a session.

## 4. Authorize the owner locally

Use the matching repository version on the Windows PC and Node 24, with the authorization browser on that same PC. Run in PowerShell from the repository root:

```powershell
node --version
node prototype/cli.mjs auth
node prototype/cli.mjs accounts
```

`node --version` must report `v24...`. If it resolves to an older system Node, use the full path to your installed Node 24 executable consistently instead. The local-browser/remote-host split follows the provider's [same-owner VM guidance](https://developers.openai.com/siwc/token-sharing-open-source/self-hosted-vms); phone-only sign-in is not assumed.

Stop any local Storychat app before these commands. The helper prints an OpenAI authorization link; open it on this PC and complete supported account consent. For an already saved registration, use `auth <saved-account-id>` rather than creating another registration. Record the connected account ID shown by the helper, then list that account's allowed models:

```powershell
$storychatAccount = Read-Host 'Saved account ID from the helper'
node prototype/cli.mjs models $storychatAccount
$storychatModel = Read-Host 'Model slug from this authorized catalog'
```

The account ID/model slug are configuration values, not access tokens. Never paste tokens, callback URLs, encrypted credential files, private transfer keys or passwords into chat, issue reports or source. Default credentials stay in ignored `data/provider-spike/` and their separate key in ignored `secrets/provider-spike/`. Existing `STORYCHAT_DATA_DIR`/`STORYCHAT_KEY_DIR` overrides must identify the intended dedicated local runtime consistently.

The next section uses a new destination request to encrypt a single registration specifically for that host. Copying the Windows vault/key directly is not the onboarding procedure.

## 5. Prepare the destination request

Keep the deployed app unconfigured for ChatGPT during these steps. It may stay running because it has not acquired an active provider session. If this instance already has a connected provider, stop and plan a controlled replacement; never delete a lock or overwrite an active account to force an import.

In an authenticated SSH shell on the Docker host:

```sh
umask 077
mkdir -p "$HOME/storychat-handoff"
chmod 700 "$HOME/storychat-handoff"
docker exec "$storychat_container" node -e "require('node:fs').mkdirSync('/var/lib/storychat/provider/handoff',{recursive:true,mode:0o700})"
docker exec "$storychat_container" node prototype/cli.mjs handoff-prepare /var/lib/storychat/provider/handoff/request.json
docker cp "$storychat_container:/var/lib/storychat/provider/handoff/request.json" "$HOME/storychat-handoff/request.json"
chmod 600 "$HOME/storychat-handoff/request.json"
```

The prepare command creates the recipient key/session request in the protected destination runtime. Its public request can leave that host; its private recipient material cannot. Requests and their bundles expire after 24 hours. Record the safe request ID, target-host ID and expiry printed by the helper. Download only this public request through authenticated SCP, not a file supplied by an untrusted party. Verify the SSH host key and intended container before continuing.

On the Windows PC, in the repository PowerShell session:

```powershell
$storychatHost = Read-Host 'Existing SSH host alias for the Docker host'
$storychatTransfer = Join-Path (Get-Location) 'data/handoff'
New-Item -ItemType Directory -Force -Path $storychatTransfer | Out-Null
scp "${storychatHost}:storychat-handoff/request.json" (Join-Path $storychatTransfer 'request.json')
if ($LASTEXITCODE -ne 0) { throw 'Public request download failed; stop here.' }
```

`storychat-host` is an example SSH configuration alias; use your existing authenticated alias when prompted. The downloaded request is public, but authenticity matters because it selects the encryption recipient. Do not bypass SSH host-key checks or manually replace request key fields.

## 6. Move the selected local session

Keep every local app/CLI process using the selected vault stopped except this one export command. The destination request must still be valid. In PowerShell:

```powershell
node prototype/cli.mjs handoff-export $storychatAccount (Join-Path $storychatTransfer 'request.json') (Join-Path $storychatTransfer 'bundle.json')
if ($LASTEXITCODE -ne 0) { throw 'Handoff export failed; read the safe helper error before proceeding.' }
scp (Join-Path $storychatTransfer 'bundle.json') "${storychatHost}:storychat-handoff/bundle.json"
if ($LASTEXITCODE -ne 0) { throw 'Encrypted bundle upload failed; retain the local bundle for recovery.' }
```

Export is a session move, not a second active copy. Successful export prints `sourceDisconnected: true`: the selected local registration no longer has renewable tokens. It does not revoke the session being moved. Other saved accounts are unaffected. The encrypted bundle is bound to the recipient request and host. Protect it as sensitive transfer material even though it contains no plaintext credential record. Do not resume local generation/refresh for the moved registration.

Do not restore a pre-export desktop vault backup and resume that old session. The helper cannot erase credentials in snapshots or independent copies. If local authorization was renewed after export, recovery refuses to republish the old bundle while that source account has current credentials; resolve the two sessions through supported account controls before proceeding.

In the Docker host SSH shell, import using binary stdin:

```sh
chmod 600 "$HOME/storychat-handoff/bundle.json"
docker exec -i "$storychat_container" node prototype/cli.mjs handoff-import - < "$HOME/storychat-handoff/bundle.json"
```

Check the command exits successfully and records the expected request ID; retain the printed `accountId` for the next step. This uses the service's UID 1000 and its protected writable volumes; it does not run the application as root or put provider tokens in browser storage. The destination preserves its own stable host identity and encryption key.

The public request is the only file copied out of a container using `docker cp`. The encrypted bundle is read from the host through stdin; it is never copied into a root-owned container file. This deliberately avoids the inbound ownership behavior documented for [`docker cp`](https://docs.docker.com/reference/cli/docker/container/cp/). Do not replace stdin import with a plaintext token paste, Windows vault/key copy, or root application startup.

### Interrupted or failed transfer

Keep the original request, encrypted bundle and both protected runtimes until import succeeds. Within the 24-hour lifetime, rerun the same `handoff-export` command with the same account ID and request if output creation or transport failed: the encrypted source recovery journal returns the identical bundle, including after a CLI restart. It does not restore local renewable tokens. If the bundle already exists, upload that same file again rather than creating a new destination request.

Re-importing the exact same bundle is idempotent, including after a restart; the destination's consumed-request record prevents replay from overwriting tokens that have since refreshed. A different bundle for the consumed request is rejected. Retry import before activating the server. If it is already active, first clear account/model settings and redeploy the same stack to release its provider lock, perform the controlled import/recovery, then restore those settings. Never race import against active refresh or remove a lock to bypass it.

After expiry, do not attempt to salvage/decrypt the old session. Disconnect that transferred app session through ChatGPT Settings, complete fresh local authorization, and prepare a new destination request. Use new request/bundle filenames for that attempt: publication deliberately refuses to overwrite a different existing file. If any helper rejects host identity, request authenticity, owner identity or active credentials, stop and investigate rather than changing request fields or copying vault files manually. Supported reauthorization is preferable to an uncertain duplicate session.

## 7. Activate the server connection

In the Portainer Git stack's private environment settings, set:

- `STORYCHAT_ACCOUNT_ID` to the successful import's `accountId`.
- `STORYCHAT_MODEL` to the model slug selected from the same owner's authorized catalog.
- Keep `STORYCHAT_PROVIDER=chatgpt`.

Save and redeploy the stack with the same image and volumes. Reopen the stack/container details and wait for health rather than treating the redeploy request itself as completion. Portainer supports editing Git stack environment settings separately from tracked Compose and manually pulling/redeploying. [Stack update documentation](https://docs.portainer.io/user/docker/stacks/edit)

The application becomes the sole owner of provider refresh. Do not run `accounts`, `models`, `refresh`, or import concurrently against its provider runtime. Routine owner login to the web app is separate from provider sign-in; restarting a container requires app login again without clearing story history.

Through the actual HTTPS origin, confirm the configuration notice is gone and the badge says ChatGPT. Create a small original character, persona and story; send one short explicit test message. Confirm a completed reply and inspect its source-linked state. This one live request consumes the owner's normal ChatGPT allowance. Do not retry repeatedly on allowance errors, and do not enable an API-key or paid fallback. Health alone does not prove provider access.

After successful import and activation, delete the local/host transfer copies; retain the provider runtime's own protected data and keys. In the same PowerShell session:

```powershell
Remove-Item -LiteralPath (Join-Path $storychatTransfer 'bundle.json')
Remove-Item -LiteralPath (Join-Path $storychatTransfer 'request.json')
```

On the Docker host:

```sh
rm -- "$HOME/storychat-handoff/bundle.json" "$HOME/storychat-handoff/request.json"
```

These commands remove only the named transfer files. Do not delete `credentials.enc`, `vault.key`, recipient runtime files or persistent Linux lock files. Transfer-file cleanup is not a secure-erasure guarantee for SSDs, snapshots or backups.

## 8. Verify Android and recovery

On the real Android device, use the trusted HTTPS origin and verify:

1. Owner login and logout, including blocked access without the app session.
2. Character/persona/story creation, a short reply, memory source navigation, pinning, correction and removal.
3. Independent tone/detail/length preferences and resume after closing/reopening the browser.
4. Keyboard/composer scrolling, screen lock/backgrounding, and reconnection without a duplicate reply.
5. Resume after one controlled container restart; completed memories remain and app login is required again.

Record device/browser and results. If the browser offers installation, test launching from the home screen too. A desktop preview, SVG manifest or Linux CI pass does not establish Android installation/background behavior.

For a simple consistent story backup, stop the application cleanly and copy the complete story-volume contents from the stopped container to a private host directory:

```sh
umask 077
storychat_backup="$HOME/storychat-backups/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$storychat_backup/stories"
docker stop --time 150 "$storychat_container"
docker cp "$storychat_container:/var/lib/storychat/stories/." "$storychat_backup/stories"
docker start "$storychat_container"
```

Check each command's result; if copying fails, resolve it and deliberately restart the application rather than assuming the backup succeeded. Encrypt the resulting private backup using the owner's existing backup tooling. Restore and inspect a copy in an isolated instance with fake inference before calling recovery verified. Keep any SQLite journal files together. Do not restore into or overwrite a running production database.

Story backup does not back up provider authorization. The provider record and separate encryption key require their own protected recovery plan; stale rotating-session backups can require new supported sign-in. Never start a test restoration using production provider credentials. No complete backup-restore exercise or owner's actual deployment is claimed by this guide.

## Troubleshooting boundaries

| Symptom | Next action |
| --- | --- |
| Healthy container, configuration notice | Confirm account/model settings and that import completed; health deliberately avoids inference |
| Host/Origin rejection | Match exact HTTPS origin and ingress Host; do not disable request validation |
| Runtime locked | Locate the process owning the runtime; stop it cleanly. Do not delete persistent Linux lock files |
| Permission denied | Verify volume ownership UID/GID 1000 and protected directory permissions; do not run the service as root |
| Request expired/mismatch | Stop the transfer and use the helper's controlled recovery path; do not edit request fields or decrypt tokens manually |
| Upload interrupted after export | Keep the encrypted bundle and matching destination request; source authorization was moved, so do not silently resume local refresh |
| Account allowance unavailable | Preserve draft/story and wait or manage the account's provider settings; no automatic billed fallback |
| Image lacks handoff commands | Select a verified release built from a commit containing the helper, and redeploy without deleting volumes |

Ordinary deployment changes need no additional model calls, and no recurring workload is created by these instructions.
