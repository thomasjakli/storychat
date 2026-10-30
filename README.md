# StoryChat

An Android-first, self-hosted character storytelling project for private, single-user use. The goal is persistent, inspectable story memory: facts, unfinished plans, meaningful events, and relationships that continue across sessions.

The application has no in-app payments, premium tiers, virtual currency, or paid feature unlocks. External model subscriptions and hosting costs remain separate.

## Current stage

Milestone 1 personal provider feasibility is complete and pushed. Milestone 2 has a working Node 24/SQLite continuity prototype and original browser interface, 27 passing automated checks and a bounded successful live ChatGPT scenario. Real Android acceptance is pending an owner-selected device-accessible route. Docker deployment and a finished installable Android experience remain ahead.

The app has one owner login and one protected ChatGPT connection. It persists independent stories, source-linked memories, promises, relationships and fictional thoughts. The owner can inspect, correct, pin and remove memories. Explicit fake mode supports development without model calls. No separately billed API route exists. Local command-line onboarding is verified; phone-only provider sign-in and same-owner credential transfer to Docker remain untested.

Use [running instructions](docs/running.md) for startup, configuration, tests and the real-device checklist. No dependency installation or frontend build is required.

## Documents

- [Project specification](project.md): requirements, scope, milestones, and unresolved decisions.
- [Agent guide](AGENTS.md): responsibilities and development rules.
- [Prototype guide](prototype/README.md): runtime requirements, commands, local sign-in, and limitations.
- [Hosting assessment](docs/milestone-1-hosting.md): Android onboarding, credential ownership, Docker, and Tunnel considerations.
- [Verification report](docs/milestone-1-verification.md): deterministic tests, findings, and gaps.
- [Milestone status](docs/milestone-1-status.md): verified outcomes and remaining completion criteria.
- [Continuity verification](docs/milestone-2-verification.md): independent software checks, live evidence and remaining Android acceptance.

## Deployment direction

The application targets an installable PWA backed by a Docker-hosted server and durable database. The prototype uses a buildless frontend and built-in SQLite. The owner's installation will use existing Cloudflare Tunnel infrastructure. One owner-managed ChatGPT connection serves the whole instance for the owner alone. Independent stories retain separate memory and relationship contexts. Application login, ingress access control, and provider authorization remain separate layers.

Public source does not make a running instance or personal story data public. Private research, credentials, runtime data, and third-party artifacts are excluded from version control. Use original synthetic examples in public tests and documentation.

No license has been selected yet; public repository visibility alone does not grant an open-source license. Provider documentation uses specific integration eligibility categories, which must be checked independently of source visibility.
