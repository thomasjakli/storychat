# StoryChat

An Android-first, self-hosted character storytelling project for private, single-user use. The goal is persistent, inspectable story memory: facts, unfinished plans, meaningful events, and relationships that continue across sessions.

The application has no in-app payments, premium tiers, virtual currency, or paid feature unlocks. External model subscriptions and hosting costs remain separate.

## Current stage

Milestone 1 is a provider-feasibility prototype, not the finished Android application. It investigates an officially supported connection using an eligible ChatGPT subscription and does not implement a separately billed API fallback.

The prototype uses a local command-line onboarding flow. On 2026-10-30 it completed owner-authorized sign-in, catalog discovery, one structured story reply, credential renewal, and confirmed revocation. It is not a web server, Android sign-in implementation, multi-user service, or production credential manager. Milestone 1 personal provider feasibility is complete. Actual personal Docker/Android deployment remains untested.

## Documents

- [Project specification](project.md): requirements, scope, milestones, and unresolved decisions.
- [Agent guide](AGENTS.md): responsibilities and development rules.
- [Prototype guide](prototype/README.md): runtime requirements, commands, local sign-in, and limitations.
- [Hosting assessment](docs/milestone-1-hosting.md): Android onboarding, credential ownership, Docker, and Tunnel considerations.
- [Verification report](docs/milestone-1-verification.md): deterministic tests, findings, and gaps.
- [Milestone status](docs/milestone-1-status.md): verified outcomes and remaining completion criteria.

## Deployment direction

The eventual application is proposed as an installable PWA backed by a Docker-hosted server and durable database. The owner's installation will use existing Cloudflare Tunnel infrastructure. One owner-managed ChatGPT connection serves the whole instance for the owner alone. Independent stories retain separate memory and relationship contexts. ChatGPT is the selected provider; no separately billed API fallback is enabled. Application accounts, ingress access control, and provider authorization remain separate layers.

Public source does not make a running instance or personal story data public. Private research, credentials, runtime data, and third-party artifacts are excluded from version control. Use original synthetic examples in public tests and documentation.

No license has been selected yet; public repository visibility alone does not grant an open-source license. Provider documentation uses specific integration eligibility categories, which must be checked independently of source visibility.
