# Self-hosted Character Stories — Project Specification

Status: Planning complete enough for a feasibility prototype; application implementation and live provider validation have not started.
Last reviewed: 2026-10-30.

This document describes the intended product and acceptance criteria. **Confirmed** requirements come from the owner. **Proposed** choices remain implementation recommendations. **Unverified** integration assumptions need a live test. Documentation notes are dated research, not proof of account access.

## 1. Purpose

Build an Android-first interactive storytelling application in which fictional characters maintain believable continuity across conversations. Characters remember established facts, carry unfinished plans forward, and develop relationships through shared events.

The central outcome is a character who can continue a story in a later session using accurate, inspectable memories from earlier sessions. A large catalog of secondary features is not required to demonstrate that outcome.

The initial deployment serves the owner and their family. The source repository may be public; running instances, accounts, conversations, credentials, and personal assets remain private. Publishing source does not imply operating a public service.

## 2. Confirmed requirements

- Prioritize Android use.
- Restrict the initial deployment to authorized family users.
- Use the owner's existing Docker infrastructure, available on a local network and a VPS, with Cloudflare Tunnel as the preferred ingress. The initial host, hostname, and policy remain open.
- Support durable character memories and evolving relationships, with user inspection and correction.
- Make all application features available without in-app payment. No currency, payment processing, premium tiers, paid replies, paid memory slots, or paid unlocks.
- Treat external subscriptions and hosting costs separately from application feature access. Display provider limits as availability constraints, never as an upsell.
- Prefer the owner's existing ChatGPT allowance where an officially supported integration permits it. Eligibility, family use, and deployment compatibility remain unverified.
- Allow cloud inference and self-hosted storage; offline-only operation is not required.
- Provide independent controls for tone, narrative detail, and response length.

## 3. Delivery and architecture — proposed

Start with an installable progressive web app (PWA), an application server, one durable database, and a persistent media directory. Keep the first deployment small enough to maintain on either available Docker host.

The server handles user authorization, story persistence, context assembly, model requests, and validated state updates. A provider adapter isolates authentication, available models, streaming, capabilities, and usage reporting. Story logic must not depend on one vendor's request format.

Use a deterministic fake provider for ordinary development and automated tests. Label sample responses and demonstrations clearly. A fake-provider demonstration does not establish subscription eligibility or live-model quality.

Select the frontend framework, backend runtime, and database after the initial integration spike. SQLite is a candidate for a single server with modest writes; PostgreSQL is an alternative if concurrency or deployment needs justify it. A vector database, separate job service, and distributed deployment are not prerequisites.

### Android experience

- Target Android Chrome first; check other family-used browsers separately.
- Provide a manifest with a stable app ID, name, start URL, scope, standalone display, and appropriate icons. Serve the deployment over trusted HTTPS.
- Provide installation instructions that also work when the browser does not offer an install prompt. Store publication is not required.
- Make long messages, narrow screens, text contrast, touch controls, keyboard resizing, and scrolling comfortable.
- Preserve drafts during transient failures. Resume a persisted generation after backgrounding, screen locking, or network changes without automatically starting another request.
- Keep the database authoritative. If a service worker is added, cache static assets by default, exclude authenticated story responses from shared caches, and clear user-specific cached data on logout.
- Consider native Android packaging only if a demonstrated onboarding or device requirement warrants it. Packaging does not establish provider eligibility.

## 4. Core product scope

Start with one user, one character, and one story. Expand to family access after the continuity loop works.

### Characters and player personas

- Define a character's name, adult age, pronouns, appearance, personality, background, motivations, speaking style, boundaries, premise, and opening message.
- Upload an optional portrait and chat background.
- Define the player's fictional persona separately from account identity, with a name, pronouns, appearance, background, and relevant story facts.
- Snapshot/version the character definition and persona used by a story. Later library edits must not silently change established history.
- For the family MVP, support creating, editing, duplicating, archiving, and deleting characters, with personal or family-shared visibility.
- Sharing a character definition does not share a user's story or relationship with it.

### Conversation

- Present narration, actions, and dialogue in a readable chat interface.
- Support free-text replies, streamed responses, durable history, and cross-session resume.
- Show pending, streaming, completed, interrupted, and failed states clearly.
- Support retrying failed work without duplicate messages or state updates.
- Support editing the latest user message and regenerating the latest character reply. Replaced turns must invalidate their derived state and be recomputed from the last valid revision.
- Preserve full transcripts even when only selected context is sent to the model.
- Define fictional inner thoughts as authored character content, separate from model reasoning.

### Independent writing controls

The three controls are confirmed; the following choices are proposals:

| Control | Meaning | Initial options |
| --- | --- | --- |
| Tone | Emotional and conversational style | Natural, warm, playful, serious, romantic, custom |
| Narrative detail | Amount of description around dialogue | Minimal, balanced, rich |
| Response length | Desired amount of text per reply | Short, medium, long |

Save controls per story. Changing a preference must not reset memory, change provider/model, or automatically increase the context budget. Tone must respect the established character, boundaries, and relationship rather than force an unearned emotional change.

Detail and length are independent: a short reply can be descriptive, while a long one can emphasize dialogue. Apply preferences through instructions and verified provider capabilities. Length is a target rather than a guaranteed token count; narrative detail is not model reasoning effort.

### Character state panel

Display current fictional thoughts and feelings, beliefs about the player, open plans/promises, significant shared moments, and relationship development. Explain changes using story events and supporting conversation evidence. Allow memory correction, pinning, and removal without paid or progression gates.

## 5. Memory and relationship engine

### State categories

| Category | Contents |
| --- | --- |
| Scene | Location, fictional time, participants, immediate situation |
| Established facts | Explicitly established world, character, and player details |
| Character beliefs | What a character believes, including uncertain or mistaken impressions |
| Shared memories | Meaningful experiences and their emotional significance |
| Open threads | Promises, plans, questions, tensions, and unresolved conflicts |
| Milestones | Significant developments in the shared story |
| Relationship | Trust, familiarity, affection, boundaries, and stage where useful |
| Current emotional state | Mood, intentions, concerns, and the last meaningful emotional beat |
| Summary | A compact account of the story so far |

Keep state per story and, where needed, per participating character. Any internal relationship numbers are implementation aids rather than psychological measurements. Numerical scoring is not required for the first prototype.

### Distinct memory concepts

- **Automatic state:** facts, summaries, open threads, and relationship changes extracted from established story events.
- **Pinned facts:** user-maintained details given durable priority in context assembly.
- **Saved scene keepsakes:** named excerpts for later reading; a possible later feature. Saving an excerpt must not automatically inject its entire text into model context.

### Integrity rules

- Store state explicitly in the database; conversation context alone is insufficient persistence.
- Link extracted facts and state changes to source messages and the story revision that produced them.
- Distinguish facts, beliefs, and inferences; proposals, accepted plans, and completed events must remain distinct.
- Track open threads as pending, completed, cancelled, or superseded.
- Preserve conflicts for reconciliation rather than silently rewriting history.
- Respect character knowledge: independent stories and characters must not learn information they could not know.
- Preserve user corrections and pinned facts during context selection and summarization.
- Record correction/deletion suppression so removed facts are not automatically extracted again from an unchanged transcript or summary. Memory removal, factual correction, and source-message deletion are separate operations.
- Keep fictional time separate from real timestamps. Returning tomorrow must not silently advance the scene or complete a fictional plan.
- Allow creative story development while requiring extracted memories to match what was established. Fictional events must not become claims about the user's real life.

### Context assembly

Combine the story's character/persona snapshots, current scene, pinned facts, relevant memories, relationship state, compact summary, and recent messages within an explicit context budget. Reserve adequate space for instructions and output, subject to verified provider behavior.

Start with database queries and explicit relevance rules. Add embeddings or more infrastructure only when recall evaluations demonstrate a need. Retain the complete transcript for review and rebuilds even when it is not sent in full.

## 6. Turn processing and recovery — proposed

1. Authenticate the user and verify story ownership.
2. Persist the user message, generation ID, and expected story revision.
3. Assemble the relevant context and writing preferences.
4. Request a visible reply and structured proposed state changes through the provider adapter.
5. Wait for provider completion and validate the state operations, source references, and correction rules.
6. Atomically commit the completed reply and accepted state changes against the expected revision.
7. Refresh the chat and state panel.

Serialize or revision-check concurrent turns within a story. Retried or replayed local operations must be idempotent. Browser disconnection should not cancel server work automatically; resumption should query persisted status.

An interrupted stream may leave a visible partial draft but must not apply incomplete memories. If provider output completes but state validation fails, retain it for a bounded repair/retry and expose the incomplete status. Never silently apply part of a mutation set.

If the server restarts mid-request, reconcile the attempt before retrying. Do not promise exactly-once provider billing after ambiguous network failure. Latest-turn edits/regeneration must rebuild summaries, relationships, and open threads as well as individual memories, with an explicit ordering for user corrections.

Model output and imported data may propose only known operations over permitted fields; they cannot change ownership, credentials, or server settings.

## 7. Provider integration and external costs

### Preferred route and feasibility gate

Evaluate official subscription-authorized access for the owner's existing ChatGPT plan. Before committing to this route, establish account eligibility, application/deployment scope, supported onboarding, available models, capability limits, credential renewal/revocation, and authorization for each family user.

A successful desktop login alone does not prove Android onboarding or family-hosted eligibility. Do not use browser-session scraping, credentials extracted from unrelated applications, or undocumented service endpoints.

Keep separately billed APIs and self-hosted models possible behind adapters. Neither is an automatic fallback. Explain external costs and obtain the owner's selection before enabling a paid route. No provider choice creates an application premium tier.

### Dated research notes — revalidate before implementation

Official documentation was reviewed on 2026-10-30. No live request has been performed for this project.

- The documented subscription flow targets eligible local/open-source uses and directs remotely hosted offerings to an access process; a public repository does not by itself establish eligibility. [Integration scope](https://developers.openai.com/siwc/token-sharing-open-source).
- Dynamic registration specifies a loopback callback with PKCE, state, and nonce validation. A remote web backend cannot assume an arbitrary HTTPS callback or that a PWA can open a local listener. [Registration](https://developers.openai.com/siwc/token-sharing-open-source/sign-in).
- A documented self-hosted VM path authorizes locally and transfers a protected session, retaining the VM's own host ID and refresh ownership. This is a possible onboarding topology to evaluate. [VM guidance](https://developers.openai.com/siwc/token-sharing-open-source/self-hosted-vms).
- The reviewed HTTP inference flow requires streaming and application-supplied history with storage disabled. Several ordinary API fields and hosted tools are unsupported; generated media/audio needs separate capability validation. [Limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations).
- Discover models for the authorized account and require the provider's successful terminal event before accepting completion. Allowance errors can occur after partial streaming. [Inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference).
- Isolate account registrations, protect tokens outside browser storage, serialize rotating-token refresh, and link to provider usage settings. [Sessions](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions).

Do not expose controls based on unsupported API fields or invent a remaining-allowance meter. Record supported usage data where available. Writing preferences are not promises of exact token usage or guaranteed provider limits.

### Operating principles

- Preserve drafts and story data when allowance or provider access is unavailable.
- Bound retries, repair attempts, background work, and context growth.
- Avoid unnecessary model calls; evaluate combining narrative and state output if reliable and supported.
- Never silently activate paid usage.
- Hosting, storage, electricity, and external inference/media may still cost money. No measured savings estimate is established.

## 8. Accounts, storage, and data ownership

- Invite-only accounts, no public registration or discovery.
- Enforce ownership server-side for stories, messages, state, assets, exports, and model connections.
- Separate family-library sharing from story access and credentials.
- App login and provider authorization are different permissions; one person's subscription is not assumed to cover other users.
- Avoid implying end-to-end encryption: a server administrator may have technical access to stored content.
- Provide versioned, validated character/story exports and compatible imports for the family MVP. Exclude credentials and deployment secrets.
- Support deletion with documented consequences for linked memories, assets, and retained backups.
- Bound upload sizes, accepted types, and imported document sizes. Render text or a restricted markup subset; arbitrary scripts/HTML are outside the MVP.
- Minimize logs of conversation content and keep secrets out of source, frontend bundles, exports, and diagnostics.

Initial entities: user/session; model connection and credential reference; versioned character/persona; story/participant; message/generation attempt; scene/state revision; fact/memory/source reference; correction/deletion suppression; open thread; relationship change; summary; media asset. Saved-scene collections can follow later.

## 9. Docker deployment

Docker and Cloudflare Tunnel are the confirmed deployment baseline for the owner's installation. The specific host, route, and Access policy are not yet selected or inspected.

- Supply an application image and Compose setup with persistent database/media storage, health checks, migrations, environment examples, and backup/restore instructions.
- Use one active deployment and authoritative database initially. Keep the image portable between local and VPS hosts; two available hosts do not imply active-active replication.
- Reuse an existing tunnel connector where practical. Do not require a new hosting service or paid infrastructure.
- Route a selected HTTPS hostname to the application, keeping database/internal service ports off public interfaces. Configure the connector-to-origin protocol for its actual network path and validate certificates where HTTPS is used. [Tunnel setup](https://developers.cloudflare.com/tunnel/get-started/).
- Configure family access explicitly. Tunnel transport does not by itself create an Access allow policy. Validate Access tokens at the origin or connector when relying on Access protection; do not trust arbitrary identity headers. Preserve per-user application authorization. [Access guidance](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/).
- Test streaming and recovery through the actual hostname, tunnel, and sessions. Exclude private API/story responses from edge caching.
- Keep tunnel tokens, provider credentials, and application encryption keys outside version control and ordinary story exports.
- Back up database and media consistently. If using SQLite, use a supported live-backup method rather than blindly copying a live file. Test restoration separately from credential recovery. [SQLite backups](https://sqlite.org/backup.html).
- Do not change the owner's external infrastructure merely to prepare source files.

Application authentication, Cloudflare access, and provider authorization remain separate layers. Tunnel ingress does not resolve provider onboarding or eligibility.

## 10. Milestones and acceptance criteria

### Milestone 1: Provider feasibility

- Establish deployment eligibility and a supported onboarding topology: browser, callback listener, and credential storage locations.
- Complete authorized sign-in and one successful real reply using the intended allowance.
- Validate structured-output handling, account/model selection, credential renewal/revocation, and interrupted/denied requests.
- Inject failure cases with a fake provider rather than exhausting real allowance.
- If subscription access is unavailable, record the outcome and present alternatives before enabling a different route.

### Milestone 2: One-character continuity prototype

- Start a story from a character/persona definition on Android.
- Establish a fact, an accepted promise, and an emotionally meaningful event, each with source references.
- Resume after server restart and use saved state after the source turn leaves recent-message context.
- Correct a fact and remove a memory; verify both persist through later extraction and summarization.
- Distinguish a planned event from its completion, reconcile a conflict, and avoid advancing fictional time merely because real time passed.
- Demonstrate inspectable inner thoughts and relationship development grounded in events.
- Persist independent tone/detail/length controls without resetting state or changing the provider/model.

### Milestone 3: Family MVP and deployment

- Deliver character/persona management, personal/family library visibility, and invite-only users.
- Verify that two users sharing a character cannot access each other's stories, assets, memories, or model connections.
- Verify retry, concurrency, interruption, latest-turn editing/regeneration, export/import, and restored backups.
- Install/launch from an Android home screen; check real-device keyboard, scroll, background/reconnect, logout, and account-switch behavior.
- Deploy through the selected Docker/tunnel route and verify allow/deny behavior, origin protection, streaming, session expiry, and data preservation during container replacement.
- Document repeatable setup, migrations, backups, restore, and credential recovery.

### Later enhancements

Saved scene keepsakes; suggested replies; novel-style reading; multiple characters; deeper branching/rewind; generated scene media/gallery; speech/dictation/live calls; native packaging; notifications. Evaluate these individually after the core acceptance criteria pass. No enhancement introduces feature payment or progression gates.

## 11. Out of scope

- Running a public hosted service, open registration, social discovery, follower systems, or creator monetization.
- In-app purchases, subscription tiers, virtual currency, or paid/progression feature unlocks.
- Reproducing another product's branding, exact interface, assets, or implementation.
- Assuming unlimited inference, guaranteed subscription integration, or fully offline generation.
- Adding multiple providers, distributed infrastructure, vector storage, generated media, or live speech before a concrete need is demonstrated.

## 12. Public repository boundaries

The intended public repository contains original application source, neutral documentation, synthetic examples/test fixtures, and configuration templates. It must not depend on access to private reference material to build, test, or understand the product.

Keep third-party application packages, screenshots, extracted code/resources, private analysis, personal stories, credentials, and runtime databases outside published source. Preserve local research separately; do not copy third-party creative assets, character text, or branding into shipped examples.

Ignore rules are an aid against accidental additions, not an audit of previously committed content. Before publication, inspect staged files and existing history. Only original source and approved documentation belong in public commits; publishing those files does not publish a running instance or private research.

Repository name, application identity, and source license remain owner decisions. Public source availability and private family access are compatible but are separate choices.

## 13. Open decisions

- Initial local or VPS host, OS/CPU architecture, storage paths, and backup destination.
- Application hostname, tunnel connector, Access policy, and app login method.
- Supported subscription onboarding and eligibility for this deployment/account; acceptable alternative if unavailable.
- Family users and each user's provider authorization.
- Acceptance of PWA delivery for the first release.
- Interface language and original initial character/story; support German story text without deriving a UI-language requirement from private examples.
- Framework/runtime/database choice after feasibility work.
- Default writing-control options and settings.
- Public repository name, app identity, and license before publication.

Do not turn unanswered preferences into confirmed requirements. Implementation choices may be resolved pragmatically within the agreed scope; live account consent and external spending decisions require the owner's involvement.

## 14. Supporting references and maintenance

- [Web app manifests](https://web.dev/learn/pwa/web-app-manifest).
- [PWA installation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).
- Provider, tunnel, access-control, and backup sources are linked beside their relevant constraints above.

Maintain this file as the current product specification, not a transcript of research. Update confirmed decisions, milestone evidence, and dated provider constraints as work progresses. Keep private provenance/research records separate from public documentation. This maintenance practice does not create a scheduled monitor.
