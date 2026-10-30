# Subscription feasibility spike

This is a bounded CLI experiment, not the Android app or a deployed multi-user service. It has no API-key route, paid fallback, tool execution, automatic inference retries, or background inference jobs. Use a maintained Node.js release (22 or later); no npm dependencies or install step are required.

From the repository root:

```powershell
node prototype/cli.mjs fake
node prototype/cli.mjs init
node prototype/cli.mjs auth
node prototype/cli.mjs accounts
node prototype/cli.mjs models <account-id>
node prototype/cli.mjs probe <account-id> <model-slug>
node prototype/cli.mjs refresh <account-id>
node prototype/cli.mjs revoke <account-id>
node prototype/test.mjs
```

Use the account ID returned by `auth` and an exact slug returned by `models`. `probe` makes **one real synthetic inference request using the selected ChatGPT allowance**. `refresh` renews credentials but does not run inference. No command selects a different account or model silently. Use `auth <account-id>` to reauthorize an existing registration. `auth` without an ID registers a separate connection. No sign-in command makes an inference request automatically.

For `auth`, open the displayed OpenAI URL in a browser **on the computer running the CLI**, complete authentication and review consent yourself. The listener binds only `127.0.0.1` on an available port and expires after ten minutes. The link has no retained ID token. Do not paste callback URLs or credentials into chat. Android-first web onboarding is not implemented: a phone browser cannot complete this desktop loopback callback. No credentials from Codex, browser sessions, or other apps are read.

The default ignored runtime locations are `data/provider-spike/credentials.enc` and `secrets/provider-spike/vault.key`. Override directory locations with `STORYCHAT_DATA_DIR` and `STORYCHAT_KEY_DIR`. Initialization applies owner-only directory permissions (owner and SYSTEM on Windows), creates a random AES-256-GCM key, and writes an encrypted credential vault atomically. The separate key file must be protected and backed up separately; encryption does not protect against compromise of the logged-in OS account or a host administrator. Unix files use mode `0600`, directories `0700`. Windows uses .NET ACLs through Windows PowerShell. ACL failure stops the operation. One exclusive runtime lock spans each command, including refresh, preventing two local CLI processes rotating the same session concurrently. Linux uses persistent advisory lock files that must never be deleted; kernel ownership is released after a crash. On Windows only, manually verify no command is running before removing a stale exclusive `.lock` marker. Do not run the same transferred refresh session concurrently on two hosts.

The vault holds a stable host UUID and separate client-ID/verified-subject records. Sign-out clears tokens and retains the registration mapping for later authorization. If remote revocation cannot be confirmed, disconnect the app in ChatGPT settings. A crash after a successful remote refresh but before its local atomic save can still require reauthorization. No exactly-once network guarantee is claimed.

For a self-hosted VM, use the [first-deployment guide](../docs/first-deployment.md). The `handoff-prepare`, `handoff-export` and `handoff-import` commands move a selected same-owner session in a recipient-encrypted bundle, preserve the VM's separate host ID and disable the selected desktop session before publishing its bundle. A protected journal permits interrupted export recovery; consumed-request records prevent import replay from restoring stale tokens. Requests expire after 24 hours. Authenticate request/bundle transport through SSH and keep the destination as the sole refresh owner. Never copy the whole vault/key or restore old desktop credentials to resume a moved session. Synthetic tests do not establish actual-host subscription access.

`ChatGPTProvider` isolates account model discovery, refresh, Responses SSE, and revocation. `generate()` requires a selected model, history array and allowed source IDs; optional `onDelta` callbacks contain provisional text only. Consumers must not apply state until the returned envelope validates. The CLI withholds provisional text. The `FakeProvider` supports `success`, `denied`, `interrupted`, and `invalid` modes and never uses the network. Fake results are not live-quality or eligibility evidence.

The probe asks for strict JSON schema and also validates locally: an original fictional reply and up to ten source-linked memories, with facts, intentions and completed events distinct. It writes no story state. A valid JSON shape does not prove a memory is semantically justified. One owner-authorized live probe with `gpt-6.1-sol` passed on 2026-10-30; other models and arbitrary stories remain unverified. Refusal, incomplete streams, denied usage and missing completion fail closed. Unsupported route fields (including `max_output_tokens`) are omitted; the probe requests a concise answer but cannot enforce a provider-side hard output-token cap. Streaming has a two-minute deadline and bounded local output sizes. No repair call is made automatically.

Manage your plan usage in [ChatGPT settings](https://chatgpt.com/#settings/Usage). App usage shares applicable subscription limits; sign-in success alone is not proof that an inference request or a Docker deployment is verified.

Official documentation researched 2026-10-30:

- [Registration and sign-in](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)
- [Accounts, refresh and revocation](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions)
- [Model discovery and completed inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference)
- [Preview constraints](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations)
- [Self-hosted VMs](https://developers.openai.com/siwc/token-sharing-open-source/self-hosted-vms)
- [Scope of local projects versus remotely hosted applications](https://developers.openai.com/cookbook/articles/sign-in-with-chatgpt)

JWT verification uses only Node's cryptography with an RS256 allowlist and OpenAI's fixed HTTPS JWKS endpoint. Signature, issuer, issued-client audience, expiration, nonce on sign-in, and selected subject on reauthorization/refresh are checked. This hand-built bounded spike is not a substitute for a reviewed OAuth integration before exposing the personal web application.
