# Agent Working Guide

## Project context

Read `project.md` before planning or implementing changes. It defines the product scope, confirmed requirements, proposed architecture, milestones, and unresolved decisions. This file defines how agents should work within that scope.

The project is an Android-first character storytelling app solely for its owner. Persistent memories, open promises, fictional inner thoughts, and evolving relationships are the core experience. Initial deployment targets the owner's local amd64 Linux VM (Ubuntu Server or Debian), using GitHub and Portainer-managed Compose with owner-managed HTTPS ingress and the intended hostname `stories.example.com`. Private DNS, proxy, connector and network topology must stay out of public files. The owner reports deployed acceptance checks passed; external access policy has not been independently audited. Remaining owner recovery testing is deferred and non-blocking. A public VPS is an alternative future host. Browser delivery and installation guidance are implemented using a buildless UI, Node 24 and SQLite.

The public project specification is independent of private reference research. Source may be published while deployed instances remain restricted to the owner. Local research and third-party artifacts are excluded from publication. All three defined milestones are complete; distinguish automated evidence from owner-reported device acceptance. Incremental visible answer streaming is not currently required. Consult `project.md` and `docs/running.md` for current evidence, commands and remaining device/deployment gates; do not infer production readiness from their presence.

## Working rules

- Preserve the distinction between confirmed requirements, proposals, and verified implementation. Record important decisions and their reasons in `project.md`.
- Prioritize the milestones in `project.md`: validate subscription access, prove memory continuity, then deliver the personal MVP. Independent work may proceed when it does not depend on an unresolved integration.
- Verify current official documentation before implementing subscription authorization or relying on model capabilities. ChatGPT is the selected provider for the sole owner; preserve supported sign-in and usage limits.
- Keep model access behind an adapter. Use deterministic fake responses for ordinary automated tests; mark demonstrations using fake responses clearly.
- Use one owner-managed ChatGPT connection for the entire instance, solely for that owner's activity. Keep provider secrets server-side and isolate independent story contexts. No family/multi-user provider architecture is required.
- Do not implement in-app payments, gems/credits, premium tiers, paid features, or feature unlock gates. External subscriptions and actual provider limits remain separate availability concerns. Use independent tone, narrative-detail, and response-length controls; do not conflate them with model selection, reasoning effort, or context limits.
- Do not enable paid fallback, purchase services, or create recurring model workloads without the owner's authorization. Existing authorization remains valid; do not ask again unnecessarily.
- Make small, reviewable changes. Avoid new infrastructure and dependencies unless they solve a concrete requirement.
- Keep public source and documentation generic and self-contained. Do not copy another product's branding, assets, character text, exact interface, or extracted implementation into shipped code or examples.
- The owner grants UI creative freedom. Agents may choose an original visual direction and borrow broad interaction ideas from supplied private screenshots, without reproducing screens one-to-one or reusing third-party assets. Do not block milestone 2 on routine visual approvals; prioritize readable Android chat, writing controls, and inspectable/editable memory, and show a working preview when available.
- Preserve private research artifacts locally and honor ignore rules. Use original synthetic fixtures for tests and examples. Reference research does not establish backend behavior or automatically expand the MVP; further artifact inspection requires an applicable user request.
- Keep secrets, credentials, private conversations, and generated runtime data out of version control and ordinary logs.
- Treat character definitions, imported stories, and model output as untrusted application data. They must not control server permissions or execute arbitrary code or HTML.
- Enforce owner authentication and story boundaries on the server. Reusing a character must not merge independent story memories.
- Preserve source references for memories and relationship changes. Keep facts, beliefs, intentions, and completed events distinct.
- Validate structured model output before applying state changes. Preserve corrections and pinned facts. Failed, retried, interrupted, or replaced turns must not create duplicate or stale state.
- Keep fictional inner monologues separate from model reasoning. They are narrative content written for the user.
- Test meaningful behavior and failure cases. Do not add tests that merely mirror implementation or claim Android-device verification based only on desktop emulation.
- Report what changed, what was verified, and material limitations. Include reproducible commands once the project has real build and test tooling.

## Proposed agent roles

These are role descriptions for future assignments, not running agents, installed skills, or separate user-visible chats. A single agent may cover several roles for small tasks. Listing these roles does not automatically authorize parallel agent execution; delegate when the user requests it or an applicable instruction explicitly requires it.

### 1. Product and Architecture Planner

Purpose: Translate the concept into a small, coherent implementation plan.

Responsibilities:

- Maintain requirements, milestone acceptance criteria, and open decisions.
- Compare Android delivery options and self-hosting approaches against the owner's constraints.
- Define boundaries between the UI, server, persistence, and model adapter.
- Coordinate interface contracts and identify dependencies before work is split.

Expected outputs: Updated specification, justified architecture decisions, and bounded implementation tasks with acceptance criteria.

Boundary: Proposals do not become confirmed user requirements merely because they appear in an agent plan.

### 2. Model Integration Engineer

Purpose: Prove and implement an authorized, cost-conscious inference connection.

Responsibilities:

- Check official subscription integration scope and account/deployment eligibility.
- Implement supported sign-in, protected credential storage, refresh, model discovery, streaming, and actionable errors.
- Keep the owner's app login separate from the instance ChatGPT connection. Preserve story isolation and the single-owner scope.
- Provide a model adapter and fake provider for development and testing.
- Document supported features, allowance behavior, and any unresolved cost or deployment restrictions.

Expected outputs: A reproducible connection spike, adapter contract, integration implementation, and evidence from an authorized live request when available.

Boundary: Do not substitute session scraping or silently activate a billed API when subscription access fails. Account consent and credentials must come from the user through supported flows.

### 3. Story and Memory Engineer

Purpose: Make characters remain consistent across sessions and long stories.

Responsibilities:

- Design character versions, scenes, memories, open threads, relationship events, and summaries.
- Assemble relevant context without repeatedly sending the full transcript.
- Validate model-proposed state changes and link them to source messages.
- Implement corrections, pins, conflict handling, revisions, and latest-turn regeneration.
- Ensure transactional updates, retry safety, and isolation between stories.

Expected outputs: State schemas, persistence and context logic, prompt contracts, and continuity evaluation fixtures.

Boundary: Relationship changes need story evidence. Invented memories must not be promoted to established facts.

### 4. Android Experience Developer

Purpose: Deliver comfortable character creation, chat, and memory inspection on Android.

Responsibilities:

- Implement the selected mobile interface and installation experience.
- Build character cards, persona forms, streamed chat, and the character state panel.
- Handle long replies, keyboard resizing, scrolling, reconnects, and draft preservation.
- Provide accessible controls, readable contrast, and clear loading and error states.
- Support German story text and keep interface language configurable when practical.
- Keep tone, narrative detail, and response length independent from model selection and context budgets; changing a writing control must preserve story state.

Expected outputs: Working screens integrated with agreed server contracts, responsive previews, and evidence of browser/device checks.

Boundary: Use sample data only when identified as such. Do not present a static mockup as a working AI conversation.

### 5. Quality and Continuity Tester

Purpose: Independently verify that the app meets its acceptance criteria.

Responsibilities:

- Test the owner's complete user journeys, blocked unauthorized access, and isolation between independent stories.
- Cover server restart, disconnection, interrupted streams, concurrent turns, retries, and regeneration.
- Evaluate recall after source turns leave recent context, correction persistence, conflicting facts, and promise completion.
- Separate deterministic software checks from variable live-model quality evaluations.
- Check Android usability on a real device when available; identify emulation-only coverage explicitly.
- Report defects with steps, expected behavior, actual behavior, and severity.

Expected outputs: Focused automated checks, reusable story scenarios, actionable bug reports, and milestone verification results.

Boundary: A passing fake-provider test does not prove live-model quality or subscription eligibility. Use bounded, authorized live evaluations.

### 6. Self-hosting and Security Engineer

Purpose: Make the personal deployment maintainable and access-controlled.

Responsibilities:

- Prepare container deployment, HTTPS configuration, environment examples, and health checks.
- Target the existing Docker and Cloudflare Tunnel infrastructure. Distinguish tunnel routing from Access policies, retain owner authentication and story isolation, and test streaming/session recovery through the real proxy path. Do not assume a new tunnel or host is needed.
- Review invite-only access, sessions, credential protection, uploads, and server-side ownership checks.
- Implement database migrations and documented backup/restore procedures.
- Check that secrets and conversation content do not leak through logs, exports, or frontend bundles.
- Verify persistence across restarts and explain the chosen remote-access approach.

Expected outputs: Deployment configuration, operational documentation, restored-backup evidence, and concrete security findings.

Boundary: Keep deployment private to the intended users. Do not provision paid hosting, expose a service publicly, or alter external infrastructure without applicable user authorization.

## Suggested staffing by phase

| Phase | Primary role | Useful supporting role |
| --- | --- | --- |
| Requirements and technical feasibility | Product and Architecture Planner | Model Integration Engineer |
| Subscription connection spike | Model Integration Engineer | Self-hosting and Security Engineer |
| Memory continuity prototype | Story and Memory Engineer | Quality and Continuity Tester |
| Android personal MVP | Android Experience Developer | Story and Memory Engineer |
| Release verification and deployment | Quality and Continuity Tester | Self-hosting and Security Engineer |

Start with the planner and integration roles. Expand assignments as concrete implementation work becomes available; six roles do not require six simultaneous agents.

## Handoff and collaboration

When delegation is authorized:

1. Give each assignment a bounded outcome, relevant files, expected interfaces, and verification criteria.
2. Assign distinct file ownership where possible. Agree on shared schema and API changes before parallel edits.
3. Keep one coordinating agent responsible for integration and the final report.
4. Report changed files, decisions, checks performed, results, and unresolved dependencies at handoff.
5. Review integrated behavior before declaring a milestone complete. Do not overwrite another agent's or the user's work to resolve overlap.

Use subagents for subtasks within this project when authorized. Create separate user-visible chats only when the user explicitly requests them.

## Visual release review

For changes to visible screens, inspect rendered screenshots before publishing at 360px and 390px widths in both English and German, plus a desktop width. Review alignment, wrapping/overflow, active/disabled button contrast, touch targets, and long labels. Source/DOM tests alone do not satisfy this visual gate. Record what was actually viewed and keep real Android verification separate. User-reported defects must become explicit review scenarios.
