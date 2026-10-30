# StoryChat

An Android-first, self-hosted character storytelling project for private, single-user use. The goal is persistent, inspectable story memory: facts, unfinished plans, meaningful events, and relationships that continue across sessions.

The application has no in-app payments, premium tiers, virtual currency, or paid feature unlocks. External model subscriptions and hosting costs remain separate.

## Current stage

Milestone 1 personal provider feasibility is complete and pushed. Milestone 2 has a working Node 24/SQLite continuity prototype, original browser interface, automated continuity checks and a bounded successful live ChatGPT scenario. Milestone 2 Android Firefox acceptance is complete based on owner-reported deployed checks. Milestone 3 adds library management, latest-turn replacement and backup/restore; milestone 3 is complete by owner acceptance, with remaining manual recovery checks deferred as a non-blocking follow-up. A Linux/amd64 image, Portainer-compatible Compose configuration and encrypted credential-handoff helper prepare the project for personal deployment; the owner reports successful Android acceptance.

The app has one owner login and one protected ChatGPT connection. It persists independent stories, source-linked memories, promises, relationships and fictional thoughts. The owner can inspect, correct, pin and remove memories. Explicit fake mode supports development without model calls. No separately billed API route exists. Local command-line onboarding is verified; handoff tests use synthetic credentials. The owner reports successful deployed ChatGPT access. Phone-only provider authorization is not implemented; supported SSH-assisted setup remains available.

Use [running instructions](docs/running.md) for startup, configuration, tests and the real-device checklist. No dependency installation or frontend build is required.

Follow the [first-deployment guide](docs/first-deployment.md) for Portainer setup, same-owner session handoff and activation. The [container guide](deploy/README.md) and [deployment evidence](docs/deployment-verification.md) explain packaging and verified platform results. Publishing an image does not deploy an owner instance or authorize its provider connection.

## Documents

- [Project specification](project.md): requirements, scope, milestones, and unresolved decisions.
- [Agent guide](AGENTS.md): responsibilities and development rules.
- [Prototype guide](prototype/README.md): runtime requirements, commands, local sign-in, and limitations.
- [Hosting assessment](docs/milestone-1-hosting.md): Android onboarding, credential ownership, Docker, and Tunnel considerations.
- [Verification report](docs/milestone-1-verification.md): deterministic tests, findings, and gaps.
- [Milestone status](docs/milestone-1-status.md): verified outcomes and remaining completion criteria.
- [Continuity verification](docs/milestone-2-verification.md): independent software checks, live evidence and owner-reported Android acceptance.

## Deployment direction

The application targets an installable PWA backed by a Docker-hosted server and durable database. The prototype uses a buildless frontend and built-in SQLite. The owner's installation will use existing Cloudflare Tunnel infrastructure. One owner-managed ChatGPT connection serves the whole instance for the owner alone. Independent stories retain separate memory and relationship contexts. Application login, ingress access control, and provider authorization remain separate layers.

Public source does not make a running instance or personal story data public. Private research, credentials, runtime data, and third-party artifacts are excluded from version control. Use original synthetic examples in public tests and documentation.

No license has been selected yet; public repository visibility alone does not grant an open-source license. Provider documentation uses specific integration eligibility categories, which must be checked independently of source visibility.
