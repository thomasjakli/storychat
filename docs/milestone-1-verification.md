# Milestone 1 verification

Reviewed 2026-10-30 by the Quality and Continuity Tester role.

## Result

The offline feasibility harness passes **48 tests, 0 failures, 0 skipped**, including nested cases, using Node.js 24.22.1 on Windows. Tests use original synthetic stories, generated signing keys, fake provider HTTP responses, real local loopback callbacks, and temporary fake credential files. They make no real provider requests and do not read the owner's credential vault.

This verifies local failure handling and contracts. It does not establish account/deployment eligibility, live model behavior, Android onboarding, successful provider renewal/revocation, or Docker/tunnel compatibility. The later coordinator live check and latest single-owner scope resolve the personal provider-feasibility gates; deployment/device verification remains later work.

## Reproduce

From the repository root with a supported Node runtime:

```powershell
node prototype/test.mjs
```

The runtime used for this review was the bundled Node 24.22.1 executable. The Windows vault test invokes built-in Windows PowerShell to inspect filesystem ACLs. Run it under the intended normal user account, outside a restrictive managed agent sandbox.

The first sandboxed run found that PowerShell's `Set-Acl` module could not load; the implementation was changed to the .NET ACL API. The resulting owner-only ACL correctly blocked the managed sandbox capability token. A subsequent approved run outside that sandbox passed the complete suite with no ACL relaxation. This is an environment distinction, not proof that every target host has been tested.

## Verified behavior

| Area | Evidence |
| --- | --- |
| Authorization transaction | Random independent state/nonce/verifier, S256 challenge, resource binding, no verifier in authorization URL; mismatched state, expired/replayed callback, denial, conflicting returning client ID rejected. |
| Loopback callback | Real local HTTP callback plus injected token/JWKS responses completes sign-in; HTTP client receives full success response and no-store/no-referrer headers before listener shutdown. Denial yields complete safe HTTP 400 response with no token exchange or credential acceptance. |
| Signed identity | Locally generated RSA signature accepted; wrong issuer/audience/subject/nonce, expiration, future not-before, conflicting authorized party, wrong algorithm/key, malformed/signature-invalid token rejected. |
| Credential contract | Subscription scope, renewable credentials, Bearer token type, positive expiration required; code exchange sends transaction verifier and validates nonce before returning credentials. |
| Credential storage | AES-GCM roundtrip, plaintext absent from ciphertext, tampering rejected, missing key cannot silently replace an existing vault's key. Actual Windows DACL inheritance disabled with current user and SYSTEM as the only principals. |
| Concurrency | In-process refresh requests coalesce; rotated credentials persist before use. Failed persistence blocks following inference. Vault lock rejects a second writer and releases after an action throws. |
| Model selection | Only listed catalog entries exposed; malformed catalog and unavailable model rejected before inference. |
| Inference request | Supplied history, `store: false`, streaming, and strict JSON schema sent to the expected subscription endpoint; generated output returned only after terminal success and local validation. |
| Stream integrity | Unicode and CRLF preserved across single-byte chunks; allowance denial after partial output, transport interruption, missing terminal success, incomplete/error events, malformed data, conflicting terminal status and late events rejected; event/output size limits enforced. |
| State envelope | Explicit fact/intention/completed-event kinds and allowed source references; unknown fields, injected operation fields, cross-story source IDs, invalid/empty output, and excess memories rejected. This is a probe schema, not the future complete memory engine. |
| Revocation | Only issuer-origin HTTPS revocation metadata accepted; selected refresh token sent; local tokens cleared on confirmed and unconfirmed remote revocation; lost authorization requires sign-in. |
| Error handling | Provider error bodies and raw transport messages excluded from surfaced errors; no automatic HTTP retry. |
| Fake demonstrations | Visibly synthetic successful output; deterministic denied, interrupted, and invalid-output cases fail. |

## Review findings and limits

The implementation contains one live subscription adapter and one deterministic fake adapter. Inspection found no API-key integration, separately billed provider fallback, purchase flow, background scheduler, or automatic inference loop. The CLI's `probe` command performs a single synthetic request after an account/model is explicitly selected. Fake-response tests cannot verify provider capability claims.

The Windows credential protection defect and conflicting returning-client handling found during review were corrected before the passing run. Filesystem encryption protects a copied credential file only while the separate key remains protected; it does not protect against the owner, administrator, or a compromised process with both paths available.

The loopback tests exercise listener startup, callback dispatch, fake token exchange, identity verification, HTTP response delivery, and listener shutdown. Immediate `closeAllConnections()` after callback resolution did not truncate either response in the tested Node 24 run; these checks provide no evidence of a shutdown defect. They do not automate a real browser or provider login. Real sign-in, provider catalog, structured-output support, renewal, revocation, allowance behavior, and any self-hosted session transfer require separate live evidence. Refresh tests prove local serialization and rotation handling, not provider acceptance. No app account isolation, persistent story database, PWA, Android device, container host, or Cloudflare route is implemented or verified by these tests.

The Node 24 directory runner `node --test prototype/tests` failed with `MODULE_NOT_FOUND`; the supplied launcher discovers explicit file paths and avoids shell wildcard portability issues.

## Outstanding milestone gates

| Acceptance criterion | Status |
| --- | --- |
| Establish intended deployment eligibility and supported onboarding | Sole-owner local flow verified; same-owner VM topology documented. Actual host handoff remains deployment work. |
| Complete authorized sign-in and one real reply under intended allowance | Passed in the coordinator's subsequent local live check; not inferred from offline tests. |
| Structured output and account/model selection | Real catalog and one `gpt-6.1-sol` schema request passed; broader model quality untested. |
| Renewal and revocation | Passed in the coordinator's subsequent local live check. |
| Interrupted/denied requests | Synthetic HTTP/SSE failures verified without exhausting allowance. |
| Android and Docker/tunnel compatibility | Documented constraints only; device/host/proxy-path tests pending. |

Offline tests alone do not establish a live integration. Completion also relies on the coordinator live check and latest single-owner scope recorded below; keep credentials and authorization URLs out of reports.

## Coordinator live check — 2026-10-30

After this independent offline review, the owner completed supported browser authorization on the local PC. The coordinator verified catalog discovery, one structured synthetic reply through the authorized subscription route, explicit renewal, and confirmed remote revocation with local token clearing. This is separate evidence from the synthetic test suite. It demonstrates the local personal account path; actual selected-host deployment remains unverified. See [current milestone status](milestone-1-status.md).

Latest requirement clarification supersedes earlier family-sharing plans: the owner is the sole user and wants ChatGPT as the provider. The verified personal adapter matches that scope. Milestone 1 personal provider feasibility is complete; no multi-user service or Docker/Android deployment pass is claimed.

## Pre-commit review — 2026-10-30

The final `node prototype/test.mjs` launcher was independently rerun with bundled Node 24.22.1 outside the managed sandbox: **48 passed, 0 failed, 0 skipped**. Public source/document candidates were inspected without opening the owner's actual runtime vault. No third-party product names, packaged artifacts, obvious token/private-key literals, or personal story content were found in those candidates; synthetic credentials and story fixtures are explicitly identified. Ignore checks confirmed exclusion of the private analysis, screenshots, encrypted runtime credentials, and vault key. This targeted review is not a guarantee against every possible secret pattern.

The single-owner scope is consistent across the specification, agent guide, overview, and current milestone status. The CLI retains explicit account-registration selection as a feasibility tool; it does not implement multi-user app access or authorize shared subscription use. The future application should expose one owner-managed connection. No additional live request was made for this review.
