# Milestone 1: hosting and credential feasibility

Reviewed: 2026-10-30. Role: Self-hosting and Security Engineer.

Latest scope update: the owner is the sole user, with one ChatGPT connection for that same owner. Earlier family/shared-use discussions are superseded. Local provider feasibility passed; actual same-owner Docker handoff, Android operation, and Tunnel integration remain deployment work.

This is a documentation assessment and proposed deployment boundary. No provider account was signed in, host inspected, Docker image built, tunnel changed, or real-device flow tested by this assessment. It does not establish account eligibility or a completed milestone.

Local environment evidence: the coordinating agent found a Docker CLI but no running daemon; no service was started. An initial synthetic Windows vault smoke test failed closed before saving because the child Windows PowerShell process could not load `Set-Acl`. The implementation agent replaced that call with .NET ACL application. Retesting inside the managed sandbox encountered `EPERM` against the protected directory. The final suite passed outside that sandbox, including owner-only Windows ACL, encryption, tamper, and cleanup checks with synthetic values. The protected ACLs were preserved.

## Findings from official OpenAI documentation

### Eligibility remains conditional

The published ChatGPT plan-usage flow covers open-source and locally hosted applications. Its overview sends paid or remotely hosted offerings to an interest form. It also describes a user's self-hosted VM as another host for the same registration and workspace. These statements support investigating a personal VM deployment; they do not explicitly approve a family service that lets several users consume the owner's subscription. Making the source public alone is insufficient evidence of that permission. [Integration overview](https://developers.openai.com/siwc/token-sharing-open-source)

**Assessment for current scope:** The owner-only local test passed. A same-owner VM handoff is documented and is the deployment candidate; actual transfer and selected-host operation remain to be verified. A hosted multi-user service is outside the current scope.

### Browser and callback must run together

Dynamic registration uses an HTTP callback on `127.0.0.1`, for example `http://127.0.0.1:1455/auth/callback`. Ports may change; scheme, host and path must stay consistent. Start the listener before opening the browser. Authorization and code exchange must use exactly the same callback URI. Use fresh state, nonce and S256 PKCE; validate the ID token's signature, issuer, audience, expiry and nonce and the granted plan-usage scope. A valid identity token alone does not grant inference. Credentials are written atomically with owner-only permissions. [Registration and sign-in](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)

**Inference for Android:** A phone browser's loopback is the phone, not the Docker host. A remote PWA cannot assume it can start that listener or substitute its Cloudflare HTTPS hostname. An Android native helper would be additional implementation and verification work. Android can still use the eventual application after supported onboarding elsewhere; phone-only subscription onboarding remains unproven.

### Self-hosted session transfer is documented

The VM procedure creates a stable VM host ID first, completes OAuth locally with the same tool/client, user and workspace, and securely transfers the selected credential record, including issued client ID and tokens. The VM keeps its own host ID and owns subsequent refresh. Transferred sessions currently lack host-specific usage attribution and revocation. [Self-hosted VMs](https://developers.openai.com/siwc/token-sharing-open-source/self-hosted-vms)

**Proposed operating rule:** Treat transfer as a handoff, not as replication. Stop local use and refresh of that token set before import, remove the temporary transfer copy, and do not run two hosts from cloned refresh credentials. Moving the service between the owner's two Docker hosts needs an explicit migration rather than simultaneous active instances.

### Session lifecycle requirements

Keep registrations separate by verified identity and issued client ID, including registrations with identical email addresses. Keep tokens out of browser storage, source control, URLs and diagnostics. Serialize refresh for each session and atomically replace its rotating credentials. Sign-out stops requests, attempts revocation at the discovery document's revocation endpoint using the refresh token and issued client ID, and clears local tokens. Report unconfirmed remote revocation and offer ChatGPT Settings as the recovery route. Plus usage is shared across connected apps; this is not a new allowance. [Accounts and sessions](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions)

The token reference currently specifies one-hour access tokens and 30-day rotating refresh tokens, with renewal extending the latter lifetime. Respect returned expiry/refresh metadata rather than relying only on hardcoded lifetimes. [Token reference](https://developers.openai.com/siwc/token-sharing-open-source/token-reference)

## Current single-owner architecture

The owner is both the sole application user and administrator. One instance-wide ChatGPT connection serves that owner's activity. Each story keeps its own context. No family-user onboarding or shared subscription service is required. Use desktop-assisted authorization and the documented same-owner host procedure during deployment.

## Personal onboarding and deployment topology

1. Run the prototype's local helper on the owner's Windows PC. It listens only on loopback and uses the PC's system browser for account consent. Never ask the owner to paste tokens into chat.
2. Complete one owner-authorized request locally and record only sanitized evidence: selected model, success/failure, structured validation and completion status.
3. For a deployment trial, select one existing Docker host, initialize its persistent host ID and an owner-only credential directory, then stop local token use.
4. Transfer only that registration through an authenticated encrypted channel such as SSH. Import without replacing the destination host ID. The server becomes the sole refresh owner. These are deployment requirements, not a claim that the initial spike already provides an import command.
5. Connect Android to the application over the selected HTTPS hostname. Keep provider tokens exclusively on the server. App login, Cloudflare Access and provider consent remain three distinct permissions.
6. Restrict the application to that same owner through authentication and the chosen Access policy. No additional production provider or paid API fallback is required.

This initially requires a desktop onboarding step. It is a recommendation for the feasibility spike, not a confirmed final product requirement.

## Docker and Cloudflare constraints

Proposed requirements for the later server trial:

- One active application process owns refresh per credential session. Use an unprivileged container user and persist the host identity and credentials outside the image in a restricted writable volume. Atomic token rotation requires write access; a read-only secret mount alone cannot store refreshed credentials.
- On Linux use owner-only credential files and directories; on Windows enforce equivalent ACLs. Mount only the required runtime directory, never the developer's whole profile or another application's credentials. Encryption keys, if added, stay outside the database and backup payload they protect.
- Reuse the existing connector. Expose the app only on its private container network or a restricted host binding. Do not publish the callback listener, database or credential directory through Tunnel. Outbound provider HTTPS, DNS and accurate time must work.
- Cloudflare documents Access policies as the authorization layer combined with Tunnel transport. Restrict the owner's hostname explicitly; do not equate a routed hostname with an allow policy. [Tunnel integrations](https://developers.cloudflare.com/tunnel/integrations/)
- When relying on Access identity, validate its signed JWT at the origin or configured connector and bind it to app ownership. Arbitrary incoming identity headers are insufficient. Verify issuer, audience, expiry and signing keys. [Validate Access JWTs](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- Keep private API responses out of caches. Disable any application proxy buffering that delays streaming, and test first-event delivery and completion through the actual route. Persist generation status so reconnects and Access-session expiry do not automatically duplicate provider requests.
- Back up story data separately from renewable provider sessions. Restoring an older rotating refresh token may require reauthorization; never start a restored test container with production credentials. No credential recovery or proxy compatibility has been demonstrated yet.

These are proposed deployment acceptance conditions, not changes to existing infrastructure. Host architecture, origin address, hostname, Access configuration and backup destination remain owner decisions.

## Remaining evidence required

| Check | Current status |
| --- | --- |
| Supported local callback and VM handoff | Local callback passed in subsequent coordinator live check; VM handoff untested |
| Owner's account consent and plan-usage grant | Passed in subsequent coordinator live check |
| One real completed reply and structured payload | Passed in subsequent coordinator live check |
| Live credential renewal/revocation | Both passed in subsequent coordinator live check |
| Personal deployment scope | Sole-owner local path verified; same-owner VM path documented, actual handoff untested |
| Docker restart, protected volume and credential migration | Proposed, not tested |
| Android onboarding | Desktop-assisted path proposed; phone-only unproven |
| Android chat, Access allow/deny, streaming and reconnect through Tunnel | Not tested |

The coordinator completed local sign-in, catalog discovery, one structured reply, renewal, and revocation. Windows owner-only storage also passed outside the managed sandbox without weakened ACLs. The local Docker daemon is unavailable, so no container build/run occurred. Milestone 1 personal provider feasibility is complete. Host selection, secure handoff, and real Android/proxy verification remain deployment work. See [current milestone status](milestone-1-status.md).
