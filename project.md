# Self-hosted Character Stories — Project Specification

Status: Milestone 1 complete and pushed. Milestone 2 complete: automated continuity checks and owner-reported deployed ChatGPT/Android Firefox acceptance pass. Milestone 3 is complete by owner acceptance on 2026-10-30; remaining owner recovery testing is deferred and non-blocking. The Linux/amd64 container and encrypted same-owner credential handoff pass synthetic Linux CI and are published for first deployment. The owner reports successful personal-host ChatGPT connection, replies, Android Firefox checks, restart persistence and story isolation. This is owner-reported evidence, not agent-observed device testing. The owner reports fully passing milestone 3 manual checks 1–4; check 5 (export/recovery) was partially tested, with remaining checks explicitly deferred.
Last reviewed: 2026-10-31.

Owner-selected update policy (2026-10-30): publish `ghcr.io/thomasjakli/storychat:latest` after successful verification and publish-candidate container tests. Keep full commit tags and immutable digests for rollback. The owner may use `latest` in Portainer and explicitly re-pull/recreate; publication does not automatically update the running stack.

Implemented connection setup (2026-10-30): the verified SIWC adapter uses SSH-forwarded loopback sign-in directly on the Docker host, followed by explicit catalog model selection saved in its protected runtime. Codex device-code login is documented, but its credentials are not established as interchangeable with this adapter; managed app-server authentication also has hosted-service restrictions. No Codex credential reuse or new inference provider is enabled. The implemented launcher temporarily stops/restarts the app, mounts only provider/key volumes in a non-root helper and requires no credential-file transfer to the PC. Synthetic verification and image publication passed; the existing encrypted handoff remains available. [SIWC sign-in](https://developers.openai.com/siwc/token-sharing-open-source/sign-in), [app-server authentication scope](https://learn.chatgpt.com/docs/app-server#auth-endpoints), [SSH callback transport](https://learn.chatgpt.com/docs/auth#fallback-forward-the-localhost-callback-over-ssh).

This document describes the intended product and acceptance criteria. **Confirmed** requirements come from the owner. **Proposed** choices remain implementation recommendations. **Unverified** integration assumptions need a live test. Documentation notes are dated research, not proof of account access.

## 1. Purpose

Build an Android-first interactive storytelling application in which fictional characters maintain believable continuity across conversations. Characters remember established facts, carry unfinished plans forward, and develop relationships through shared events.

The central outcome is a character who can continue a story in a later session using accurate, inspectable memories from earlier sessions. A large catalog of secondary features is not required to demonstrate that outcome.

The deployment serves only its owner. It uses one instance-wide ChatGPT connection for that same owner; family access and multiple app users are outside the current scope. The source repository may be public; running instances, accounts, conversations, credentials, and personal assets remain private. Publishing source does not imply operating a public service.

## 2. Confirmed requirements

- Prioritize Android use.
- Restrict the deployment to its sole owner. Require owner authentication for remote access; no public registration or family-user onboarding.
- Deploy initially on the owner's local Docker host, using GitHub and a Portainer-managed Compose stack (owner selection, 2026-10-30). The intended hostname is `stories.example.com`. Ingress is owner-managed. The owner reports successful deployed access and logout checks; agents have not independently audited the external Access policy. The VPS remains an alternative future host.
- Support durable character memories and evolving relationships, with user inspection and correction.
- Make all application features available without in-app payment. No currency, payment processing, premium tiers, paid replies, paid memory slots, or paid unlocks.
- Treat external subscriptions and hosting costs separately from application feature access. Display provider limits as availability constraints, never as an upsell.
- Configure one owner-managed ChatGPT provider connection for the whole deployment instance. All requests arise from the owner's own activity (latest owner clarification, 2026-10-30).
- Proceed with the owner's existing ChatGPT allowance through the tested supported sign-in route. No separately billed API or provider fallback is enabled.
- Allow cloud inference and self-hosted storage; offline-only operation is not required.
- Provide independent controls for tone, narrative detail, and response length.
- Next update: English and German interface, English by default, with language preference saved per device/browser profile. Story content is not automatically translated.
- Agents have creative freedom over the UI. Supplied private screenshots may inform broad interaction and atmosphere, but the interface must be an original design rather than a one-to-one reproduction (owner clarification, 2026-10-30).

## 3. Delivery and architecture

The deployed application uses an Android-friendly browser interface, an application server and SQLite. Installation guidance is available. Media uploads remain a later enhancement.

The server handles user authorization, story persistence, context assembly, model requests, and validated state updates. A provider adapter isolates authentication, available models, streaming, capabilities, and usage reporting. Story logic must not depend on one vendor's request format.

Only one owner-managed ChatGPT connection is active per instance. Keep credentials server-side, bound concurrency and context growth, and isolate each story's context. The owner is both the application user and administrator. No multi-user service or credential sharing is required. The adapter boundary and fake provider remain useful for tests; no additional production provider is needed.

Use a deterministic fake provider for ordinary development and automated tests. Label sample responses and demonstrations clearly. A fake-provider demonstration does not establish subscription eligibility or live-model quality.

Implementation choice for milestone 2: Node 24 with built-in SQLite, a small HTTP server, and buildless HTML/CSS/JavaScript. SQLite transactions persist story aggregates; no external database, frontend framework, dependencies, vector service, or job service is needed for this prototype. The tested runtime is Node 24.22.1; Node 18 on the development PC is insufficient. [Node SQLite reference](https://nodejs.org/docs/latest-v24.x/api/sqlite.html).

### Android experience

- Android Firefox is owner-tested. Check additional browsers separately when used.
- Provide a manifest with a stable app ID, name, start URL, scope, standalone display, and appropriate icons. Serve the deployment over trusted HTTPS.
- Provide installation instructions that also work when the browser does not offer an install prompt. Store publication is not required.
- Make long messages, narrow screens, text contrast, touch controls, keyboard resizing, and scrolling comfortable.
- Preserve drafts during transient failures. Resume a persisted generation after backgrounding, screen locking, or network changes without automatically starting another request.
- Keep the database authoritative. If a service worker is added, cache static assets by default, exclude authenticated story responses from shared caches, and clear user-specific cached data on logout.
- Consider native Android packaging only if a demonstrated onboarding or device requirement warrants it. Packaging does not establish provider eligibility.

## 4. Core product scope

### Visual direction and design autonomy

The agents may choose layout, typography, palette, navigation, and component styling without waiting for a detailed visual brief. Use a coherent, original visual direction suited to character storytelling. Private reference screenshots may inspire broad ideas such as illustrated character cards, immersive reading, or accessible memory panels; do not trace their screens, copy distinctive compositions, or reuse third-party branding, artwork, icons, or character text.

Milestone 2 needs a usable Android-focused interface for character/persona setup, conversation, independent writing controls, and memory inspection/correction. Prioritize legibility, comfortable scrolling and composing, and clear generation/error states. Establish a consistent visual foundation without expanding into a full discovery catalog or polishing deferred features. Show a working preview when available and incorporate feedback while continuing independent implementation. Routine visual choices do not require prior approval.

The public application must build and run without the private screenshots. Use original or appropriately licensed assets and synthetic character content. This design freedom does not change milestone acceptance criteria or authorize deployment changes.

Start with one user, one character, and one story. Add more independent stories and characters after the continuity loop works; retain single-user access.

### Characters and player personas

- Define a character's name, adult age, pronouns, appearance, personality, background, motivations, speaking style, boundaries, premise, and opening message.
- Optional portrait and chat-background uploads remain a later enhancement.
- Define the player's fictional persona separately from account identity, with a name, pronouns, appearance, background, and relevant story facts.
- Snapshot/version the character definition and persona used by a story. Later library edits must not silently change established history.
- For the personal MVP, support creating, editing, duplicating, archiving, and deleting characters in the owner's private library.
- Reusing a character in a new story creates independent memory and relationship state.

### Conversation

- Present narration, actions, and dialogue in a readable chat interface.
- Support free-text replies, validated completed responses, durable history, and cross-session resume. Incremental visible answer streaming is not required for now (owner decision, 2026-10-30).
- Show pending, completed, interrupted and failed states clearly. Provider transport streams internally; visible replies appear after validation.
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

Use the supported ChatGPT sign-in route for the sole owner, as verified in milestone 1. The provider choice is settled. Keep inference limited to that owner's activity. Desktop-assisted sign-in is the verified onboarding path; use the documented same-owner host procedure when preparing a personal Docker deployment. [Same-owner host guidance](https://developers.openai.com/siwc/token-sharing-open-source/self-hosted-vms).

Successful local sign-in does not by itself verify phone-only onboarding or an actual Docker/Android deployment. Do not use browser-session scraping, credentials extracted from unrelated applications, or undocumented service endpoints.

Keep separately billed APIs and self-hosted models possible behind adapters. Neither is an automatic fallback. Explain external costs and obtain the owner's selection before enabling a paid route. No provider choice creates an application premium tier.

### Dated research notes — revalidate before implementation

Official documentation was rechecked on 2026-10-30. The owner completed local authorization; account catalog discovery, one structured model reply, credential renewal, and confirmed revocation succeeded. See the [milestone status](docs/milestone-1-status.md) for live evidence and remaining gates. This verifies personal access for the tested request, not unlimited usage or a deployed Android application.

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
- Enforce provider concurrency/context limits at instance level while isolating the owner's separate story contexts.
- Never silently activate paid usage.
- Hosting, storage, electricity, and external inference/media may still cost money. No measured savings estimate is established.

## 8. Accounts, storage, and data ownership

- One owner account, no public registration, invites, family accounts, or discovery.
- Enforce ownership server-side for stories, messages, state, assets, and exports. Restrict the instance provider connection and credentials to administrators.
- Keep the personal character library separate from each story's state and provider credentials.
- Application login and provider authorization both belong to the sole owner. Keep browser app sessions separate from protected provider credentials.
- Avoid implying end-to-end encryption: a server administrator may have technical access to stored content.
- Provide versioned, validated character/story exports and compatible imports for the personal MVP. Exclude credentials and deployment secrets.
- Support deletion with documented consequences for linked memories, assets, and retained backups.
- Bound upload sizes, accepted types, and imported document sizes. Render text or a restricted markup subset; arbitrary scripts/HTML are outside the MVP.
- Minimize logs of conversation content and keep secrets out of source, frontend bundles, exports, and diagnostics.

Initial entities: user/session/administrator role; instance provider configuration and credential reference; versioned character/persona; story/participant; message/generation attempt; scene/state revision; fact/memory/source reference; correction/deletion suppression; open thread; relationship change; summary; media asset. Saved-scene collections can follow later.

## 9. Docker deployment

Docker and owner-managed HTTPS ingress are the deployment baseline. The selected target is a local amd64 Linux VM running Ubuntu Server or Debian, with GitHub as the source repository and Portainer managing Compose. The exact distribution and private storage arrangements are operational details, not outstanding product milestones. Deployed use is owner-accepted; external policy has not been independently audited. Private DNS, proxy, connector and network details belong outside public documentation. Owner deployment is reported working; this documentation does not authorize changes to external infrastructure.

- Supply an application image and Compose setup with persistent database/media storage, health checks, migrations, environment examples, and backup/restore instructions.
- Selected deployment approach (2026-10-30): Portainer manages a Git-backed Compose stack from the existing GitHub repository, using a prebuilt versioned application image. Runtime storage and provider credentials remain outside the checkout and instance values are supplied separately. A source commit alone must not be treated as an updated container image. Start with explicit deployment of a tested image version; automatic production rollout is a separate choice. Named volumes hold the private runtime data. No owner Portainer stack or GitOps rollout job has been configured by agents. [Git stacks](https://docs.portainer.io/user/docker/stacks/add), [update behavior](https://docs.portainer.io/faqs/troubleshooting/stacks-deployments-and-updates/how-do-automatic-updates-for-stacks-applications-work).
- Deployment preparation implementation (2026-10-30): an exact-patch Node 24.22.2 Linux/amd64 Dockerfile, deny-by-default build context, non-root/read-only Compose stack, three protected volumes, Host-aware health check and 150-second shutdown grace are prepared. Linux database/provider locks use `flock`, preserving lock inodes and recovering after process death; Windows retains fail-closed marker recovery. The server drains within a 130-second deadline, creates private files with umask 077 and can read a bounded owner password file. Actual Linux/container results and publication status are recorded separately in [deployment verification](docs/deployment-verification.md). No real credentials or model calls are used in container tests.
- `.github/workflows/container.yml` uses pinned actions and standard public-repository Linux runners for synthetic tests, Compose validation and actual container tests. Only a verified `master` commit can publish its tested image under a full commit-SHA tag at GHCR; pull requests cannot publish. No cache or retained Actions artifacts are configured. GitHub currently documents free standard runners for public repositories and free Container Registry storage/bandwidth; no billing setting or paid service is enabled. [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [Packages billing](https://docs.github.com/en/billing/concepts/product-billing/github-packages).
- Verified container evidence (2026-10-30): source commit `db6d88ef3453f672c634e59478b1e127b9897a6c` passed all 33 application/lifecycle checks and 48 provider checks on Ubuntu 24.04 with Node 24.22.2, with no skipped tests. Actual Docker smoke checks passed in both verification and publication jobs, covering non-root/read-only operation, private files, authentication, state, restart/replacement, forced termination, interrupted turns and a synthetic encrypted vault. The tested image was pushed to `ghcr.io/thomasjakli/storychat:sha-db6d88ef3453f672c634e59478b1e127b9897a6c`. Anonymous manifest/config retrieval confirmed digest `sha256:aea134ae5b9cb7796f1ef202853ec868dd3dada39461d51bdf3618e5bf6f014c`, Linux/amd64 and UID/GID 1000. This verifies image availability, not deployment on the owner's VM. [Workflow run](https://github.com/thomasjakli/storychat/actions/runs/41102134906).
- Handoff release evidence (2026-10-30): commit `6ac9e6ec3b4ce17afffefbeebe314fdc4c1e3bed` passes all 33 application and 58 provider/handoff checks on Linux with no skips. Actual container smoke verifies CLI stdin import, destination host preservation, source disconnection, encrypted storage and replay protection after replacement. CI also exposed and fixed a startup readiness/shutdown-handler race; its regression checks three immediate shutdown/restart cycles. Anonymous registry retrieval confirms the Linux/amd64 UID 1000 image at `ghcr.io/thomasjakli/storychat@sha256:fccec0160036496da7ca72d54a64b630d0a73a184faada5c55c7646a6bd0a84d`. [Release verification](https://github.com/thomasjakli/storychat/actions/runs/41107642425), [first-deployment guide](docs/first-deployment.md).
- Deferred operational follow-up: finish owner-side export/import and backup/restore checks. Provider connection, deployed replies and Android acceptance are owner-reported complete. Runtime credentials must never enter CI or the image; agents have not accessed the production instance.
- Use one active deployment and authoritative database initially. Keep the image portable between local and VPS hosts; two available hosts do not imply active-active replication.
- Reuse an existing tunnel connector where practical. Do not require a new hosting service or paid infrastructure.
- Route a selected HTTPS hostname to the application, keeping database/internal service ports off public interfaces. Configure the connector-to-origin protocol for its actual network path and validate certificates where HTTPS is used. [Tunnel setup](https://developers.cloudflare.com/tunnel/get-started/).
- Configure owner-only access explicitly. Tunnel transport does not by itself create an Access allow policy. Validate Access tokens at the origin or connector when relying on Access protection; do not trust arbitrary identity headers. Preserve per-user application authorization. [Access guidance](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/).
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

Implementation update, 2026-10-30: a dependency-free local CLI in `prototype/` implements supported loopback sign-in, per-account model discovery, renewable credentials, revocation, SSE handling, and a source-linked structured probe. Credentials are encrypted with a separately protected key; no API-key fallback or automatic inference loop exists. Independent QA passed 48 deterministic tests on Windows using Node 24.22.1, including owner-only ACL checks and real loopback callbacks with synthetic provider responses. Protected runtime tests require execution outside the managed sandbox; ACLs were not weakened.

The owner completed browser consent. Eight models were discovered; a single `gpt-6.1-sol` probe returned a short reply and an intention linked to its supplied message ID, passing strict schema validation. Forced credential renewal and provider-confirmed revocation succeeded, and local renewable tokens were cleared. The latest scope is solely the owner's personal use, which matches the tested local path. **Milestone 1 is complete for personal provider feasibility.** This paragraph records the original local feasibility evidence; subsequent container and owner deployment acceptance are recorded under milestones 2�3. The local Docker daemon is unavailable. Detailed evidence: [verification](docs/milestone-1-verification.md), [hosting assessment](docs/milestone-1-hosting.md), [current status](docs/milestone-1-status.md).

### Milestone 2: One-character continuity prototype

- Start a story from a character/persona definition on Android.
- Establish a fact, an accepted promise, and an emotionally meaningful event, each with source references.
- Resume after server restart and use saved state after the source turn leaves recent-message context.
- Correct a fact and remove a memory; verify both persist through later extraction and summarization.
- Distinguish a planned event from its completion, reconcile a conflict, and avoid advancing fictional time merely because real time passed.
- Demonstrate inspectable inner thoughts and relationship development grounded in events.
- Persist independent tone/detail/length controls without resetting state or changing the provider/model.

Implementation update, 2026-10-30: `app/` and `public/` implement a sole-owner password/session-protected browser prototype, persistent character/persona snapshots and separate stories, strict source-linked facts/beliefs/events, pending/completed threads, relationships, authored thoughts, fictional scenes, corrections, pins, deletion suppression, and independent writing controls. Source links navigate to the retained transcript. Failed or interrupted generations apply no model state; stale completions are rejected. An instance serializes generation and holds the ChatGPT vault lock. ChatGPT is the default provider; fake mode must be explicitly selected and is labelled. No paid fallback exists.

Original milestone 2 verification: 27 automated checks passed, including independent scenarios with a separate Node process, SQLite restart/recall outside the six-message recent window, correction/deletion, conflict reconciliation, isolation, authentication and atomic failure recovery. The milestone 1 regression suite then passed 48/48; current release counts are recorded below. Desktop in-app browser checks passed login, original character/persona/story creation, chat, source navigation, correction, pinning, and independently saved controls at the available narrow viewport; these are not Android-device results.

Live evaluation: the first request passed schema validation but left an authored thought only in the reply. The prompt was corrected; a subsequent four-request `gpt-6.1-sol` evaluation passed sourced state extraction, recall after database reopen and seven deterministic filler turns, corrected pinned preference, deletion suppression, explicit promise completion and fictional-time advancement. Five live requests total, no automatic retries or billed fallback. This is one synthetic scenario, not general semantic reliability. [Verification details](docs/milestone-2-verification.md), [running instructions](docs/running.md), [interface contract](docs/milestone-2-contract.md).

**Milestone 2 complete, 2026-10-30:** the owner reports successful deployed ChatGPT replies and Android Firefox continuity, memory correction/deletion, writing controls, reopen/restart, isolation and logout checks. This is owner-reported device evidence, distinct from automated and desktop checks. See [verification](docs/milestone-2-verification.md).

Prototype limits: recent context is six messages, selected memories plus state/summary have a fixed character budget, and each story is capped at 200 memories, 200 threads, 100 relationship and 100 thought entries, 20,000 messages and 10,000 attempts. Suppression matches normalized stable keys and text; semantic paraphrases using new keys are not reliably detected. Source validation proves permitted provenance IDs, not semantic truth. Final visible replies are withheld until complete JSON and state validation; incremental visible narrative streaming is not currently required. Retained transcripts are distinct from memory removal; database file compaction/secure erasure is not implemented.

### Milestone 3: Personal MVP and deployment

- Deliver character/persona management, private library access, and owner authentication.
- Verify unauthorized access is blocked, separate stories do not leak context, and provider credentials are never exposed to browser sessions. Verify bounded request concurrency.
- Verify retry, concurrency, interruption, latest-turn editing/regeneration, export/import, and restored backups.
- Install/launch from an Android home screen; check real-device keyboard, scroll, background/reconnect, logout, and account-switch behavior.
- Deploy through the selected Docker/tunnel route and verify allow/deny behavior, origin protection, streaming, session expiry, and data preservation during container replacement.
- Document repeatable setup, migrations, backups, restore, and credential recovery.

### Milestone 4: Character covers and scene media — planned

Current owner scope decision (2026-10-30): character title/cover uploads remain the active planned next feature. Message-based image/video generation is shelved pending a future provider discussion. Implement no generation integration or queue as part of cover uploads; provider selection does not block stage 4A. Stages 4B/4C remain deferred design only.

The owner selected media incorporation as the next feature on 2026-10-30: character title/cover images and message-linked scene images or short videos, with supported video duration, quality/resolution and sound options. Detailed scope, capability/access gates, storage, source-revision integrity, recovery and acceptance criteria are in [the media plan](docs/media-plan.md). This is planning, not implemented functionality or authorization for paid services.

Deliver in stages: **4A** private media storage, uploaded covers and backup/restore; **4B** message-linked scene images and a verified image adapter; **4C** short video and optional supported audio. Current ChatGPT plan integration does not support image generation; a subscription-authorized video route has not been established. Real automated generation requires a supported owner-approved media backend. Uploads and manual prompt/result exchange can proceed independently. No separately billed route is enabled or assumed.

### Next update: separate character exploration - planned

The owner requests an independent character-exploration page rather than managing characters only inside the story notebook. Plan separate Characters and Stories destinations, portrait cards, search/filter/detail views and explicit start-new versus continue-existing story flows. Browse local created/imported characters; do not bundle private reference data or automatically mirror an external service. Recommended model additions include optional subtitle, intro, gender, managed cover, category/tags and private provenance, keeping owner preferences separate from versioned story content. See [character exploration/model plan](docs/character-exploration-plan.md) for gaps, proposals, migrations, API contracts and acceptance.

### Next update: character fields and private migration trial - planned

Add separate Intro and Opening scene fields, a character gender selector, and a distinct introductory narrative block at the start of new stories. These accompany uploaded covers and English/German UI. Preserve original story text and snapshot semantics. Use one owner-selected character as a private trial before any wider character/story migration; do not publish reference artwork, character text or transcripts. See [character migration plan](docs/character-migration-plan.md). Existing-story migration requires a separate complete transcript/export and must not invent missing history.

### Next update: interface languages - planned

Deliver English/German UI alongside character cover uploads, with English as the default and independent per-device/browser-profile persistence. Language changes preserve drafts, story text, memories and model settings. See [interface language plan](docs/interface-language-plan.md) for storage behavior, translation scope and acceptance checks.

### Other later enhancements

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

The source repository is `thomasjakli/storychat`. Final application identity and source license remain owner decisions. Public source availability and private personal access are compatible but are separate choices; visibility alone is not an open-source license or proof of provider eligibility.

## 13. Remaining decisions and non-blocking follow-up

- Finish owner-side export/import and actual-host backup/restore testing. Automated isolated restoration passed; the owner partially tested the manual recovery group and explicitly deferred the remainder without blocking milestone 3. The exact completed subset was not specified.
- Choose the source license and confirm final application identity.
- Milestone 4 media planning is defined; media backend selection/access verification remain open. Select other enhancements only when requested.
- English/German UI is confirmed for the next update, default English with per-device persistence. Additional writing-control options remain optional preferences.
- Deployment storage/backup destinations and external access-policy administration remain private operational choices, not public infrastructure documentation. No independent external-policy audit is claimed.

All three defined milestones are complete. The existing Node 24/SQLite stack, sole-owner login, one ChatGPT connection and browser delivery remain the accepted implementation. Incremental visible answer streaming is not required for now. Do not infer unlimited provider usage or broader security guarantees from owner acceptance.

## 14. Supporting references and maintenance

- [Web app manifests](https://web.dev/learn/pwa/web-app-manifest).
- [PWA installation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).
- Provider, tunnel, access-control, and backup sources are linked beside their relevant constraints above.

Maintain this file as the current product specification, not a transcript of research. Update confirmed decisions, milestone evidence, and dated provider constraints as work progresses. Keep private provenance/research records separate from public documentation. This maintenance practice does not create a scheduled monitor.

## 15. Current acceptance and release evidence

All milestones are complete as of 2026-10-30. Milestone 1 established provider feasibility; milestone 2 established continuity and owner-reported Android Firefox acceptance; milestone 3 delivered library management, safe latest-turn replacement and recovery tooling.

The owner reports fully passing milestone 3 manual groups 1–4: library management, editing/regeneration with memory preservation, interruption/restart, Android usability/installation and logout. Recovery group 5 was partially tested and explicitly deferred as non-blocking follow-up. These are owner-reported results, not agent-observed device tests.

Corrected release commit `a96b01b0433a141bebe98157ae9b2374f60c4e76` passed 44 application and 62 provider/setup tests on Linux with no skips. Both verification/publication jobs passed actual-container isolated backup/restore and replacement checks. Details: [milestone 3 verification](docs/milestone-3-verification.md), [upgrade/rollback](docs/milestone-3-upgrade.md), [backup/restore](docs/backup-restore.md).

Use the tested rolling `latest` tag for owner-triggered pull/recreation, or pin a recorded commit/digest. Retain a pre-upgrade backup and prior digest. Legacy turns lack replacement snapshots; portable exports omit regeneration history, while offline logical backups retain it. No automatic rollout, recurring model workload or reminder automation is configured.

## Next-update implementation contracts (2026-10-31)

Implementation in progress; this entry is not acceptance evidence. External catalogue investigation/import and generation stages 4B/4C are shelved. Implement local exploration, expanded characters, uploaded covers (4A) and English/German UI together. Use additive defaults and immutable story snapshots; separate owner preferences from versioned content. Adopt proposed field bounds from the exploration plan. Character summary API uses bounded offset pagination (24 default), deterministic sorting and full detail on demand. Media uses opaque IDs, private storage and validated raster decode/re-encode with thumbnails; no remote URL fetching. UI locale is browser-local and defaults to English. Existing provider authorization stays unchanged.

File ownership: Story/Memory owns store/transfer and model tests; Security owns media/backup/container dependencies and recovery documentation; Android owns public UI; coordinating planner owns server integration, release documentation and integrated verification. Independent QA follows integration. Real-device acceptance remains pending owner verification.

### Milestone 4A integrated implementation evidence (2026-10-31)

Local character explorer/detail and separate stories/settings, versioned expanded character fields, draft/favorite preferences, bounded summary queries, safe typed intro/opening, uploaded covers and English/German browser-local interface are implemented. No external catalogue access/import or generation is included. Covers use private UUID storage, bounded JPEG/PNG/WebP sanitization, shared-reference protection and checksummed media-aware portable export and offline lossless backup. Legacy stories remain unchanged. Selector payloads omit full definitions and narratives; details are fetched on demand.

Synthetic verification includes old-data migration, immutable snapshots, restart, Unicode search/pagination, owner authentication, media validation/shared references, concurrent mutation serialization, isolated online/offline restore, failed-import rollback, zero inference for library operations, localization parity, blocked storage and authored-text preservation. Windows skips Linux-only runtime checks; container CI supplies Linux evidence. Device acceptance is pending: Android Firefox explorer/back/scroll/keyboard, focal preview/upload, long intro/opening, language switching during draft/polling, and media export/restore. Desktop source/DOM tests do not establish real-device usability. No production upgrade performed. Stage 4A remains pending owner device acceptance; 4B/4C remain shelved.

Release verification (2026-10-31): commit `8f050a51bb6004e56232399d32a6df3c67983155` passed Linux CI: 62/62 application tests, 62/62 subscription-adapter tests, parameterized Compose validation, Linux/amd64 build and both verify/publish-candidate container lifecycle tests. No live inference. Published `latest` and `sha-8f050a51bb6004e56232399d32a6df3c67983155` with immutable reference:

`ghcr.io/thomasjakli/storychat@sha256:258fe0ce2aaffd92adb5fbca4e758f7043ca631329ba047f85b0c0c09d32ac0c`

[Workflow evidence](https://github.com/thomasjakli/storychat/actions/runs/41146920415). [Upgrade, rollback and Android acceptance](docs/character-update-verification.md). Stage 4A device acceptance remains pending; running deployment was not modified.

Mobile visual correction (2026-10-31): owner reported misaligned explorer filters and low-contrast new-story action. Removed filter counters, replaced flex wrapping with an aligned responsive grid/full-width search and sort, and separated character actions from memory-action CSS (dark primary text, larger touch targets, stacked primary actions). Rendered synthetic preview screenshots reviewed at 360px/390px in English/German and desktop1280 German. This is browser viewport evidence, not Android device acceptance. AGENTS.md now requires a rendered bilingual mobile visual gate before visible UI releases.
