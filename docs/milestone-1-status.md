# Milestone 1 status

Date: 2026-10-30. Coordinator: Product and Architecture Planner.

**Outcome: milestone 1 complete for personal, single-user provider feasibility.** The latest owner clarification removes family/multi-user access. One ChatGPT connection serves only the owner. Sign-in, catalog discovery, one real structured reply, renewal, revocation, and 48 offline tests passed. ChatGPT is the selected provider. The prototype is not the Android application or a deployed server.

## Deliverables

- `prototype/`: dependency-free Node CLI, subscription adapter, fake adapter, OAuth transaction/identity verification, encrypted runtime storage, model discovery, structured response validation, and stream failure handling.
- [Prototype instructions](../prototype/README.md): exact commands, runtime requirements, onboarding, and limitations.
- [Independent QA report](milestone-1-verification.md): 48 tests passed, none failed or skipped, using synthetic data and generated keys.
- [Hosting assessment](milestone-1-hosting.md): documented desktop-assisted onboarding and conditional same-owner VM path; same-owner Docker deployment follow-up.

## Evidence matrix

| Requirement | Evidence obtained | Still needed |
| --- | --- | --- |
| Supported integration | Sole-owner local subscription path passes; official same-owner VM topology documented | Implement and verify actual selected-host handoff during deployment work |
| Local runtime | Bundled Node 24.22.1 verified; Node >=22 documented | Runtime check on selected deployment host |
| Sign-in infrastructure | OIDC discovery HTTP 200; owner completed browser consent; signed identity, nonce and plan scope validated | Revalidate on any new host/onboarding topology |
| Protected storage | Windows ACL and encryption tests pass; real session saved, renewed atomically, and cleared after revoke | Selected-host credential handling and VM handoff |
| Model choice and reply | Real authorized catalog returned eight models; one explicit `gpt-6.1-sol` request completed | Other models, broader quality and hosted use remain unverified |
| Structured state output | Live strict schema accepted; reply and intention with valid supplied source ID returned | Broader semantic evaluation and the full memory engine |
| Renewal/revocation | Forced live renewal succeeded; provider revocation confirmed and local tokens cleared | Deployment-host lifecycle and future reauthorization |
| Failure handling | Partial denial, interruption, incomplete/malformed output, and absent completion fail closed | Real failures only as naturally encountered; do not exhaust allowance to provoke them |
| Docker/Cloudflare/Android | Constraints documented; no external infrastructure changed | Select host/route, confirm scope, then verify real deployment/device paths |

The Docker CLI is installed on the development PC, but `docker version` could not connect to its daemon. No image build or container run was claimed. The system Node installation is 18.12.1, below the documented runtime; the bundled Node 24.22.1 was used for validation.

## Live evidence

The owner completed browser consent on the same Windows PC as the local loopback listener. The CLI accepted the returned identity and plan-usage grant and stored the session in the encrypted runtime. No credentials from other applications were read.

The coordinator then used the supported Node runtime for:

1. Real account catalog discovery: eight listed models.
2. One synthetic `gpt-6.1-sol` probe: the user promises to bring a map tomorrow. The response acknowledged the promise and returned an `intention` linked to `probe-user-1`, passing local schema validation after terminal completion.
3. Explicit token renewal: new credentials atomically saved.
4. Revocation: provider confirmed success and local access, refresh, and ID tokens were cleared.

Exactly one inference request was made; no repair/retry call or separately billed API route was used. The remaining vault contains the non-token registration mapping for later sign-in. Real request usage/cost was not measured; no numerical savings claim is made. Reauthorization is required to run another live probe. Do not paste callback URLs or tokens into chat or documentation.

## Limits and decisions

- This is an original local CLI spike with a hand-built, tested OAuth implementation; it still needs production review before serving the owner through the deployed web application.
- Source publication does not automatically classify the project as eligible for every integration route. No source license has been selected.
- The intended deployment now has one owner and one ChatGPT connection. Use the documented same-owner host approach; actual handoff is not implemented or tested yet.
- A remote Android PWA cannot assume its browser's loopback callback reaches the Docker host. Desktop-assisted onboarding is the initial candidate, not verified phone-only sign-in.
- No live credentials, personal stories, or authorization URLs are included in these deliverables. Runtime data and keys remain ignored.
- No persistent story state, memory engine, Android UI, container deployment, or public service has been implemented by this milestone.
- Milestone 1 source and its verification reports are ready for the initial implementation commit; later milestone work is recorded separately.

Proceed to milestone 2: persistent story state and memory continuity. Use fake-provider tests for ordinary development and bounded owner-authorized live checks as needed. Docker/Android integration remains later acceptance work; milestone 1 completion does not claim that deployment is verified. Reauthorization will be needed before another live request because the test session was revoked.
